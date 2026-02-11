# Voice Assistant - Quick Reference Guide

## At a Glance

| Aspect | Details |
|--------|---------|
| **TTS Service** | ElevenLabs (paid API) |
| **Fallback** | Web Speech API (browser built-in) |
| **Output Format** | MP3 (22050 Hz, 32 kbps) |
| **Delivery Method** | HTTP + WebSocket |
| **Queue Strategy** | Sequential playback with chunking |

---

## Key Files to Know

### Backend
```
app/services/elevenlabs_tts.py     ← ElevenLabs API wrapper (text_to_speech_bytes, text_to_speech_stream)
app/routers/tts.py                 ← HTTP endpoints (/api/tts, /api/tts/stream)
app/routers/conversation.py        ← WebSocket + streaming TTS (_stream_tts_to_ws)
app/config.py                       ← Settings & API keys (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID)
```

### Frontend
```
src/lib/tts.ts                      ← Playback & queueing (speakText, pushTtsChunk, drainTtsQueue)
src/lib/api.ts                      ← HTTP TTS client (postTts)
src/components/LiveWorkspace.tsx    ← WebSocket integration & UI handling
```

---

## Common Scenarios

### Scenario 1: User Taps Quick Reply Button
```
1. Frontend calls: speakText(reply.spoken_text, apiUrl)
2. Makes POST /api/tts { text, voice_id: null }
3. Backend calls ElevenLabs API
4. Returns MP3 blob
5. Frontend plays via new Audio() element
```

**Relevant Code:**
- Frontend: `src/lib/tts.ts` → `speakText()`
- Backend: `app/routers/tts.py` → `text_to_speech()`
- Service: `app/services/elevenlabs_tts.py` → `text_to_speech_bytes()`

### Scenario 2: Remote Peer Sends Chat Message
```
1. Backend receives chat message via WebSocket
2. Determines if recipient wants TTS (blind profile or explicit flag)
3. Calls _stream_tts_to_ws(websocket, text)
4. ElevenLabs generates MP3 chunks in thread
5. Each chunk: base64 encode → send as JSON
   { "type": "tts_audio_chunk", "audio_base64": "..." }
6. Frontend receives in LiveWorkspace
7. Calls pushTtsChunk(audioBase64)
8. drainTtsQueue() plays chunks sequentially
```

**Relevant Code:**
- Backend: `app/routers/conversation.py` → `_stream_tts_to_ws()` (lines 118-136)
- Frontend: `src/components/LiveWorkspace.tsx` → message handler (lines 227-235)
- Queueing: `src/lib/tts.ts` → `pushTtsChunk()`, `drainTtsQueue()`

### Scenario 3: Guidance Text (No Backend Needed)
```
1. Frontend calls: speakGuidance("Turn camera on...")
2. Browser's speechSynthesis API handles it
3. Plays immediately (no network needed)
```

**Relevant Code:**
- `src/lib/tts.ts` → `speakGuidance()`

---

## Data Flow Cheat Sheet

### HTTP TTS Flow
```
POST /api/tts
├─ Request:  { text, voice_id }
└─ Response: audio/mpeg blob
```

### WebSocket TTS Flow
```
Chat message arrives via /ws/conversation
├─ Backend: _stream_tts_to_ws()
│  ├─ ElevenLabs API generates chunks
│  ├─ Each chunk: base64 encode
│  └─ Send: { type: "tts_audio_chunk", audio_base64 }
│
└─ Frontend: LiveWorkspace message handler
   ├─ startNewTtsStream() [clear queue]
   └─ pushTtsChunk() [queue chunks]
      └─ drainTtsQueue() [play sequentially]
```

---

## Configuration

**Must Set (in .env):**
```bash
ELEVENLABS_API_KEY=sk_...
```

**Optional:**
```bash
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Defaults shown
MOBILE_MODE=true
MAX_AUDIO_CHUNK_BYTES=500000
```

---

## Profile-Based Defaults

| User Type | Incoming Chat TTS | Guidance TTS | Quick Reply TTS |
|-----------|------------------|-------------|-----------------|
| Deaf      | Optional         | Optional    | Yes (on tap)   |
| Blind     | **Yes (auto)**    | **Yes**     | Yes             |
| Mute      | No               | Optional    | No              |
| DeafBlind | **Yes (auto)**    | **Yes**     | Yes             |

### How It Works:
```python
# In conversation.py, when routing messages:
recv_profile = peer.get("profile_type", "deaf")
recv_wants_tts = peer.get("wants_tts", False)
want_tts = message.get("tts", False)  # Sender's intent

# Final decision:
tts_for_peer = want_tts or (recv_profile == "blind") or recv_wants_tts

if tts_for_peer:
    asyncio.create_task(_stream_tts_to_ws(peer["ws"], text))
```

---

## Testing TTS Locally

### Health Check
```bash
curl http://localhost:8000/health
# Look for: "elevenlabs": true
```

### Test HTTP Endpoint
```bash
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voice_id": null}' \
  -o test_audio.mp3

# Play with:
afplay test_audio.mp3  # macOS
```

### Check Backend Logs
```bash
# Look for TTS stream messages:
grep -i "TTS stream" logs.txt
grep -i "Chat TTS" logs.txt
```

---

## Common Issues & Solutions

### Issue: TTS Not Playing
**Check:**
1. Is `ELEVENLABS_API_KEY` set?
2. Is there remaining quota? (10,000 chars/month free tier)
3. Check console for decode errors: `[TTS] Decode/play error`

**Solution:**
- Test via `/api/tts` endpoint directly
- Check `/health` endpoint for elevenlabs status
- Review backend logs for TTS errors

### Issue: Audio Overlapping or Cutting Off
**Root Cause:** Chunks not queued properly
**Solution:**
- Verify `pushTtsChunk()` is being called
- Check `drainTtsQueue()` completes before next chunk
- Ensure `startNewTtsStream()` clears queue on new message

### Issue: Web Speech API Not Working
**Root Cause:** Browser doesn't support it or user hasn't granted permission
**Solution:**
- Check browser console for speechSynthesis availability
- Verify browser supports Web Speech API (most modern browsers do)
- Guidance uses `speakGuidance()` which has built-in error handling

---

## Voice ID Reference

Current default: `21m00Tcm4TlvDq8ikWAM`

To change voice:
1. Get new voice ID from ElevenLabs dashboard
2. Set `ELEVENLABS_VOICE_ID` env variable
3. Restart backend

No UI currently exposes voice selection - would need to:
1. Add voice selection to profile page
2. Send `voice_id` in TTS requests
3. Store user preference in profile

---

## Performance Notes

### Streaming Benefits
- **Lower time-to-first-byte:** Audio starts before generation completes
- **Memory efficient:** Chunks streamed, not buffered
- **Mobile-friendly:** Bitrate 32 kbps = ~12 KB/sec

### Queue Strategy
- **Sequential playback:** No overlapping audio
- **Handles late chunks:** `drainTtsQueue()` waits for playback to complete
- **Clean interruption:** `startNewTtsStream()` clears queue for new messages

---

## Debugging Checklist

- [ ] API key configured: `echo $ELEVENLABS_API_KEY`
- [ ] Backend running: `curl http://localhost:8000/health`
- [ ] TTS service OK in health: `"elevenlabs": true`
- [ ] Console logs: Open DevTools → Console tab
- [ ] Backend logs: Check terminal running `./run_dev.sh`
- [ ] Network tab: Check `/api/tts` requests (should return audio/mpeg)

---

## Future Improvements

1. **Voice Selection UI** - Let users pick different voices
2. **Graceful Fallback** - Use Web Speech when ElevenLabs fails
3. **Speed Control** - Rate adjustment per user preference
4. **Audio Ducking** - Lower other audio when TTS plays
5. **Multiple Languages** - Support non-English voices
