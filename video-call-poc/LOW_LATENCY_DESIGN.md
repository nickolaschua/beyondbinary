# Low-Latency STT & Tone – Design Guide

When you connect **real** speech-to-text and tone (e.g. your Beyond Binary backend), latency is dominated by:

1. **How often you send audio** (chunk interval)
2. **How fast the backend responds** (STT + tone pipeline)
3. **Whether you use streaming or partial results**

This doc summarizes design choices that keep latency low.

---

## 1. Where Latency Comes From

| Source | Typical impact | Levers |
|--------|----------------|--------|
| **Audio chunk interval** | Largest. 3s chunks ⇒ ≥3s before first result | Send smaller chunks (1–1.5s) or stream |
| **STT processing** | ~0.3–0.5s (e.g. Groq) | Use streaming STT if available; keep chunks short |
| **Tone analysis** | Backend already ~0.8s interval | Already low; main win is sending audio more often |
| **Network RTT** | ~50–200ms | Same region; keep WebSocket open |

**Bottom line:** The biggest win is **sending audio more frequently** (e.g. every 1–1.5s instead of 3s). Your backend already does transcript quickly and tone every 0.8s; it’s waiting on the next chunk that adds delay.

---

## 2. Recommended Architecture for This POC

### Option A: Backend pipeline (Groq + Hume) – lower latency

- **Capture:** Use **Web Audio API** (e.g. `ScriptProcessorNode` or `AudioWorklet`) to read from the call’s audio track in **fixed-size chunks** (e.g. 1–1.5s of PCM).
- **Send:** Encode (e.g. base64) and send each chunk over **WebSocket** to your backend (`/ws/conversation`) as `audio_chunk`.
- **Backend:** Already does:
  - Transcript soon after chunk arrives (~500ms).
  - Tone from prosody buffer every 0.8s.
- **Result:** Captions and tone feel much snappier because the backend gets audio every ~1–1.5s instead of every 3s.

**Concrete:** In `audioTap.js`, implement a real tap that:

1. Creates an `AudioContext`, creates a `MediaStreamSource` from the audio track.
2. Uses a **script processor or worklet** to pull samples every N ms (e.g. 1024 samples at 16 kHz ≈ 64 ms per buffer; aggregate to 1–1.5s then send).
3. Sends that 1–1.5s chunk to the backend WebSocket; backend responds with `transcript` and `tone_update` as it does today.

### Option B: Hybrid – instant captions, backend tone

- **Captions:** Use **Web Speech API** in the browser for **instant** interim/final transcripts; no server round-trip for words.
- **Backend:** Send the **same audio** in small chunks (e.g. 1–1.5s) for:
  - Tone (prosody buffer)
  - Optional: Groq transcript for correction/simplification/quick-replies.
- **Result:** Captions feel instant; tone still improves with smaller chunks.

Your backend already supports `text_transcript` for Web Speech; the video call client would send both:

- `text_transcript` (from Web Speech) for immediate captions.
- `audio_chunk` (small chunks) for tone and optional STT.

---

## 3. Parameter Tuning (Backend)

In `ProsodyBuffer` and any client-side chunking:

- **Lower latency:** e.g. `window_size_seconds=1.5`, `analysis_interval_seconds=0.6` (more CPU).
- **Current (good balance):** `window_size_seconds=2.0`, `analysis_interval_seconds=0.8`.
- **Battery / low CPU:** Larger window, longer interval.

Client chunk interval:

- **~1–1.5s** for a good latency/load tradeoff.
- **&lt;1s** only if backend and network can handle it.

---

## 4. What We Changed in the POC (Placeholders)

- **Captions:** Simulated interval reduced from 3s to **1.2s** so the demo feels more responsive.
- **Tone:** Simulated interval reduced from 5s to **1.5s** (your real backend is already ~0.8s).

When you replace these with real integrations, use **small audio chunks** (or Web Speech for captions) and the same backend; that will keep STT and tone latency low.
