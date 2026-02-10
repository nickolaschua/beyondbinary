"""Sliding Window Prosody Buffer for Real-Time Tone Analysis.

Maintains a rolling 2-second audio buffer for periodic prosody analysis.
Decouples tone detection from subtitle emission to minimize latency.

Design:
- Speech text is fast and incremental (immediate emission)
- Emotion is slow and stateful (periodic background analysis)
- Optimize for perceived immediacy, not theoretical simultaneity

Emits time-stamped ToneSamples for utterance-tone aggregation.
"""

import asyncio
import time
from collections import deque
from typing import Optional, Callable, Dict, Awaitable

# Bytes per second for webm/opus audio (approx) - for time range estimation
BYTES_PER_SECOND = 16_000


class ProsodyBuffer:
    """
    Rolling audio buffer for sliding-window prosody analysis.
    
    Buffers incoming audio chunks and triggers periodic tone analysis
    on the most recent ~2 seconds of audio.
    """
    
    def __init__(
        self,
        window_size_seconds: float = 2.0,
        analysis_interval_seconds: float = 0.8,
        tone_analyzer: Optional[Callable] = None,
        on_tone_update: Optional[Callable] = None,
        on_tone_sample: Optional[Callable] = None,
    ):
        """
        Initialize prosody buffer.

        Args:
            window_size_seconds: Duration of audio to keep in buffer (default 2.0s)
            analysis_interval_seconds: How often to run analysis (default 0.8s)
            tone_analyzer: Async function to analyze audio bytes → tone dict
            on_tone_update: Async callback when new tone is detected (legacy; use on_tone_sample)
            on_tone_sample: Async callback (tone_result, start_time, end_time) for aggregation
        """
        self.window_size = window_size_seconds
        self.analysis_interval = analysis_interval_seconds
        self.tone_analyzer = tone_analyzer
        self.on_tone_update = on_tone_update
        self.on_tone_sample = on_tone_sample
        
        # Rolling buffer: [(audio_bytes, timestamp), ...]
        self.buffer: deque = deque(maxlen=100)  # Bounded memory
        
        # Tone state
        self.current_tone: Optional[Dict] = None
        self.last_tone: Optional[Dict] = None
        self.tone_persistence_count = 0
        
        # Timing
        self.last_analysis_time = 0.0
        self.last_analyzed_buffer_end = 0.0
        self.last_append_time = 0.0
        self.analysis_task: Optional[asyncio.Task] = None
        self.monitor_task: Optional[asyncio.Task] = None  # Background monitor

        # Control
        self._running = False
        self._lock = asyncio.Lock()
    
    async def append_chunk(self, audio_bytes: bytes) -> None:
        """
        Add new audio chunk to the rolling buffer.
        
        Old audio is automatically evicted to maintain window size.
        Does NOT block - returns immediately.
        
        Args:
            audio_bytes: Raw audio data from WebSocket
        """
        async with self._lock:
            current_time = time.time()
            
            # Add new chunk
            self.buffer.append((audio_bytes, current_time))
            self.last_append_time = current_time
            
            # Evict old chunks outside the window
            cutoff_time = current_time - self.window_size
            while self.buffer and self.buffer[0][1] < cutoff_time:
                self.buffer.popleft()
    
    # Hume API limit is 5000ms. ~16KB/s → 5s ≈ 80KB. Cap so we never exceed.
    HUME_MAX_BYTES = 81_000

    def get_buffer_audio(self) -> bytes:
        """
        Concatenate all buffered audio chunks into a single bytes object.
        Capped at HUME_MAX_BYTES (5s) so Hume API never receives over limit.

        Returns:
            bytes: Combined audio from the window (max 5s for Hume)
        """
        raw = b''.join(chunk for chunk, _ in self.buffer)
        if len(raw) > self.HUME_MAX_BYTES:
            raw = raw[-self.HUME_MAX_BYTES:]
        return raw
    
    def should_analyze_now(self) -> bool:
        """
        Check if enough time has passed for the next analysis.
        
        Returns:
            bool: True if analysis_interval has elapsed
        """
        return (time.time() - self.last_analysis_time) >= self.analysis_interval

    def has_new_audio(self) -> bool:
        """Return True when buffer has unseen audio since last analysis."""
        if not self.buffer:
            return False
        latest_ts = self.buffer[-1][1]
        return latest_ts > (self.last_analyzed_buffer_end + 1e-6)

    def has_recent_audio(self) -> bool:
        """Return True when audio arrived recently enough to justify another Hume call."""
        if self.last_append_time <= 0:
            return False
        idle_for = time.time() - self.last_append_time
        # After brief silence, stop re-analyzing stale chunks.
        return idle_for <= max(1.0, self.analysis_interval * 2.0)
    
    async def trigger_analysis_if_ready(self) -> None:
        """
        Conditionally trigger tone analysis if interval has elapsed.

        Launches analysis as a background task - does NOT block caller.
        """
        if not self._running:
            return

        if not self.should_analyze_now():
            return

        if not self.tone_analyzer:
            return

        if not self.has_new_audio():
            return

        if not self.has_recent_audio():
            return

        # Don't launch if previous analysis is still running
        if self.analysis_task and not self.analysis_task.done():
            return

        # Launch background analysis (non-blocking)
        self.analysis_task = asyncio.create_task(self._run_analysis())

    async def _monitor_loop(self) -> None:
        """
        Background task: Continuously check if analysis should run.

        Runs every 0.1s to check if analysis_interval (0.8s) has elapsed.
        This ensures tone updates happen on schedule, not just when audio arrives.
        """
        try:
            while self._running:
                await asyncio.sleep(0.1)  # Check 10x per second

                # Trigger analysis if interval elapsed
                await self.trigger_analysis_if_ready()

        except asyncio.CancelledError:
            print("🎭 Monitor loop cancelled")
            raise
        except Exception as e:
            print(f"❌ Monitor loop error: {e}")
    
    async def _run_analysis(self) -> None:
        """
        Background task: Analyze buffered audio for prosody.
        
        Runs in parallel with subtitle emission - never blocks STT.
        Implements tone smoothing to avoid jitter.
        """
        try:
            if not self._running:
                return

            # Mark analysis time and capture buffer state BEFORE Hume call
            # (sample time range must reflect when audio was recorded, not when Hume returns)
            grab_time = time.time()
            self.last_analysis_time = grab_time
            
            # Get current window audio and capture timestamps before async Hume call
            window_audio = self.get_buffer_audio()
            buffer_start = self.buffer[0][1] if self.buffer else grab_time
            buffer_end = self.buffer[-1][1] if self.buffer else grab_time
            self.last_analyzed_buffer_end = buffer_end
            
            if len(window_audio) < 8000:  # Skip if buffer too small (~0.5s at 16kHz)
                return
            
            print(f"🎭 Running prosody analysis on {len(window_audio)} bytes ({len(window_audio)/16000:.1f}s)")
            
            # Run analysis (this is the slow part - 500-1500ms)
            tone_result = await self.tone_analyzer(window_audio)

            if not self._running:
                return
            
            if not tone_result.get("success"):
                # Analysis failed - reuse last known tone
                tone_result = self.last_tone or {
                    "primary_tone": "neutral",
                    "confidence": 0.0,
                    "success": False
                }
            
            # Tone smoothing: avoid rapid changes
            new_tone = tone_result.get("primary_tone", "neutral")
            new_confidence = tone_result.get("confidence", 0.0)
            
            should_emit = self._should_emit_tone(new_tone, new_confidence)
            
            if should_emit:
                self.current_tone = tone_result
                self.last_tone = tone_result

                # Use buffer timestamps so sample overlaps with Web Speech utterance times
                analysis_duration = len(window_audio) / BYTES_PER_SECOND
                end_time = buffer_end
                start_time = max(buffer_start, end_time - analysis_duration)

                # Emit time-stamped sample for aggregation
                if self.on_tone_sample:
                    await self.on_tone_sample(tone_result, start_time, end_time)

                # Legacy: emit tone update via callback
                if self.on_tone_update:
                    await self.on_tone_update(tone_result)
                    print(f"✅ Tone update emitted: {new_tone} ({new_confidence:.2f})")
            else:
                print(f"⏭️  Tone skipped (not stable): {new_tone} ({new_confidence:.2f})")
        
        except Exception as e:
            print(f"❌ Prosody analysis error: {e}")
            # Don't crash - just skip this analysis cycle
    
    def _should_emit_tone(self, new_tone: str, new_confidence: float) -> bool:
        """
        Emit tone updates so the frontend stays in sync. Relaxed: emit whenever
        we have a valid result (confidence > 0.05) to avoid UI stuck on old tone.
        """
        if not new_tone:
            return False
        if new_confidence is None or new_confidence < 0.05:
            return False
        self.tone_persistence_count = 1
        return True
    
    def get_current_tone(self) -> Dict:
        """
        Get the most recent tone state (non-blocking).
        
        Returns:
            dict: Current tone or neutral fallback
        """
        if self.current_tone:
            return self.current_tone
        
        return {
            "primary_tone": "neutral",
            "confidence": 0.0,
            "success": False,
        }
    
    async def start(self) -> None:
        """Start the prosody buffer and background monitoring task."""
        self._running = True

        # Start continuous background monitor
        self.monitor_task = asyncio.create_task(self._monitor_loop())

        print(f"🎭 ProsodyBuffer started (window: {self.window_size}s, interval: {self.analysis_interval}s)")
    
    async def stop(self) -> None:
        """Stop the prosody buffer and cleanup."""
        self._running = False

        # Cancel monitor task
        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass

        # Cancel any running analysis
        if self.analysis_task:
            self.analysis_task.cancel()
            try:
                await self.analysis_task
            except asyncio.CancelledError:
                pass

        self.clear()

        print("🎭 ProsodyBuffer stopped")
    
    def clear(self) -> None:
        """Clear buffer and reset state (e.g., new conversation)."""
        self.buffer.clear()
        self.current_tone = None
        self.last_tone = None
        self.tone_persistence_count = 0
        self.last_analysis_time = 0.0
        self.last_analyzed_buffer_end = 0.0
