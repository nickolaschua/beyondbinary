"""Test that prosody buffer triggers analysis at correct intervals."""

import asyncio
import time

async def mock_tone_analyzer(audio_bytes):
    """Mock analyzer - just sleeps to simulate processing."""
    await asyncio.sleep(0.2)  # Simulate Hume API call
    return {
        "success": True,
        "primary_tone": "testing",
        "confidence": 0.8,
        "top_emotions": []
    }

async def test_timing():
    from app.services.prosody_buffer import ProsodyBuffer
    
    updates_received = []
    
    async def on_update(tone_result):
        updates_received.append(time.time())
        print(f"✅ Tone update #{len(updates_received)} at {time.time():.1f}s")
    
    buffer = ProsodyBuffer(
        window_size_seconds=2.0,
        analysis_interval_seconds=0.8,
        tone_analyzer=mock_tone_analyzer,
        on_tone_update=on_update,
    )
    
    await buffer.start()
    
    print("📝 Adding audio chunks every 1 second for 5 seconds...")
    print("   (Should see ~6 tone updates at 0.8s intervals)\n")
    
    start_time = time.time()
    
    # Simulate audio chunks arriving every 1 second
    for i in range(5):
        fake_audio = b'x' * 10000  # 10KB fake audio
        await buffer.append_chunk(fake_audio)
        print(f"🎤 Chunk {i+1} added at {time.time() - start_time:.1f}s")
        await asyncio.sleep(1.0)
    
    # Wait a bit more to catch final updates
    await asyncio.sleep(2.0)
    
    await buffer.stop()
    
    # Analyze results
    print("\n" + "="*60)
    print(f"RESULTS:")
    print(f"  Total updates: {len(updates_received)}")
    
    if len(updates_received) >= 2:
        intervals = [updates_received[i] - updates_received[i-1] 
                     for i in range(1, len(updates_received))]
        avg_interval = sum(intervals) / len(intervals)
        print(f"  Average interval: {avg_interval:.2f}s (target: 0.8s)")
        print(f"  Intervals: {[f'{i:.2f}s' for i in intervals]}")
        
        if 0.7 < avg_interval < 0.9:
            print(f"  ✅ PASS: Timing is correct!")
        else:
            print(f"  ❌ FAIL: Timing is off (expected ~0.8s)")
    else:
        print(f"  ❌ FAIL: Not enough updates (got {len(updates_received)}, expected ~6)")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(test_timing())
