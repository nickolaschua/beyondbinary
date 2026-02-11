# Voice Assistant Implementation Analysis - Beyond Binary

## Executive Summary

The codebase implements a **dual-layer TTS (Text-to-Speech) architecture** using:
1. **ElevenLabs API** - Primary TTS service for high-quality voice synthesis in live sessions
2. **Web Speech API** - Fallback for accessibility guidance (guidance text, page hints)

The implementation is designed for accessibility-first user profiles (deaf, blind, deafblind, mute) with streaming audio over WebSockets and local playback using Web Audio API.

---

## 1. TTS Service Architecture

### 1.1 ElevenLabs TTS Service (Backend)

**File:** `/backend/app/services/elevenlabs_tts.py`

**Key Features:**
- **Two endpoints:**
  - `text_to_speech_bytes()` - Full audio file generation
  - `text_to_speech_stream()` - Streaming chunks for low time-to-first-byte

- **Model:** `eleven_multilingual_v2`
- **Output Format:** MP3 (22050 Hz, 32 kbps)
- **Voice Settings:**
  ```python
  stability: 0.5        # Balanced between consistent and expressive
  similarity_boost: 0.8 # Stay close to the voice's natural sound
  style: 0.0           # Neutral style
  use_speaker_boost: True
  ```

- **Default Voice ID:** `21m00Tcm4TlvDq8ikWAM` (configurable via env)
- **Rate Limiting:** Free tier = 10,000 characters/month
- **Error Handling:** Returns empty bytes on API failure, logs error

**API Authentication:**
```python
from elevenlabs.client import ElevenLabs
_client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
```

### 1.2 Web Speech API Fallback (Frontend)

**File:** `/senseai-frontend/src/lib/tts.ts`

**Usage:** `speakGuidance(text: string)`

- **Browser Standard:** Uses native `window.speechSynthesis`
- **Configuration:**
  - Language: en-US
  - Rate: 0.95x
  - Pitch: 1.0
  - Voice: Prefers en-US voice, falls back to any en voice
- **Use Cases:** Guidance hints, page instructions, non-critical announcements
- **No backend required** - Works offline

---

## 2. Voice/Audio Output Handling

### 2.1 Backend TTS Endpoints

#### POST `/api/tts` (Batch)
```
Request:  { "text": "...", "voice_id": null }
Response: MP3 audio blob (audio/mpeg)
```
- Returns complete audio file
- Simpler for single messages
- Response is cached with `Cache-Control: no-cache`

#### POST `/api/tts/stream` (Streaming)
```
Request:  { "text": "...", "voice_id": null }
Response: Streaming MP3 chunks (audio/mpeg)
Headers:  Content-Disposition: inline
```
- Lower time-to-first-byte
- Chunks arrive as they're generated
- Better for long messages
- Uses FastAPI `StreamingResponse`

**Implementation:**
```python
@router.post("/api/tts")
async def text_to_speech(request: TTSRequest):
    audio_bytes = await text_to_speech_bytes(...)
    return Response(content=audio_bytes, media_type="audio/mpeg")

@router.post("/api/tts/stream")
async def text_to_speech_streaming(request: TTSRequest):
    return StreamingResponse(
        text_to_speech_stream(...),
        media_type="audio/mpeg"
    )
```

### 2.2 Frontend Audio Playback

**File:** `/senseai-frontend/src/lib/tts.ts`

#### Function: `speakText(text, baseUrl)`
- Calls `/api/tts` endpoint
- Creates `Audio` element from blob
- Auto-plays
- Revokes object URL on completion

#### Function: `playTtsChunk(audioBase64)`
- Decodes base64 MP3 chunk
- Creates `Blob` with type `audio/mpeg`
- Creates and plays `Audio` element
- Returns Audio reference for caller

#### Function: `pushTtsChunk(audioBase64)`
- Queues chunks for sequential playback
- Uses internal queue: `ttsQueue: string[]`
- Drains queue when audio finishes via `drainTtsQueue()`
- Ensures smooth playback without gaps

#### Function: `startNewTtsStream()`
- Clears queue: `ttsQueue.length = 0`
- Resets playback state: `ttsPlaying = false`
- Prepares for new incoming message

---

## 3. WebSocket Integration (Real-time Streaming)

### 3.1 WebSocket Message Protocol

**File:** `/backend/app/routers/conversation.py` (lines 1-38)

**Incoming TTS Control Messages:**
```python
{ "type": "set_tts_preference", "value": true|false }
```

**Outgoing TTS Messages:**
```python
{ "type": "tts_audio_chunk", "audio_base64": "..." }
{ "type": "tts_audio_end" }
{ "type": "tts_error", "message": "..." }
```

**Chat Message Protocol:**
```python
{ "type": "chat_message", "sender": "remote", "text": "...", "tts": true|false }
```

### 3.2 Backend TTS Streaming (WebSocket)

**File:** `/backend/app/routers/conversation.py` (lines 118-136)

```python
async def _stream_tts_to_ws(websocket: WebSocket, text: str) -> None:
    """Run ElevenLabs TTS stream and send chunks to one client."""
    try:
        loop = asyncio.get_event_loop()
        chunks = await loop.run_in_executor(
            None, lambda: list(text_to_speech_stream(text))
        )
        for chunk in chunks:
            if chunk:
                b64 = base64.b64encode(chunk).decode("ascii")
                await websocket.send_json({
                    "type": "tts_audio_chunk",
                    "audio_base64": b64
                })
        await websocket.send_json({"type": "tts_audio_end"})
    except Exception as e:
        await websocket.send_json({
            "type": "tts_error",
            "message": "TTS unavailable"
        })
```

**Key Points:**
- Non-blocking execution in thread pool
- ElevenLabs generator → MP3 chunks → base64 → WebSocket JSON
- Error handling sends error message back to client
- Fire-and-forget (wrapped in `asyncio.create_task()`)

### 3.3 Frontend WebSocket Message Handling

**File:** `/senseai-frontend/src/components/LiveWorkspace.tsx` (lines 227-235)

```typescript
case "chat_message":
  setChatMessages((prev) => [
    ...prev,
    { 
      sender: msg.sender, 
      text: msg.text, 
      tts: Boolean(msg.tts) 
    }
  ]);
  if (msg.sender === "remote" && msg.tts) 
    startNewTtsStream(); // Clear queue for new message
  break;

case "tts_audio_chunk":
  if (msg.audio_base64) 
    pushTtsChunk(String(msg.audio_base64)); // Queue chunk
  break;

case "tts_audio_end":
  // Optional: could trigger UI updates here
  break;
```

---

## 4. Quick Replies with TTS

### 4.1 Quick Reply Generation

**File:** `/backend/app/models/schemas.py` (lines 30-32)

```python
class QuickReply(BaseModel):
    label: str           # "How serious is it?" (button text)
    spoken_text: str     # "Could you tell me how serious this is?" (natural TTS)
```

**Key Distinction:**
- `label`: Short button text for visual display
- `spoken_text`: Full natural phrasing for audio output

### 4.2 TTS for Quick Replies

When user taps quick reply button:
1. Frontend sends to `/api/tts` endpoint
2. Backend returns MP3 audio
3. Frontend plays audio through speaker

**Implementation:**
```typescript
// In frontend (LiveWorkspace.tsx)
<button 
  onClick={() => {
    speakText(reply.spoken_text, apiUrl); // TTS the natural phrasing
    // Send message to backend...
  }}
>
  {reply.label}
</button>
```

---

## 5. Profile-Based TTS Behavior

### 5.1 User Profiles

| Profile | TTS for Incoming | TTS for Guidance | TTS for Quick Replies |
|---------|------------------|------------------|----------------------|
| **deaf** | No | Optional | Yes (on demand) |
| **blind** | Yes (WebRTC chat) | Yes | Yes |
| **mute** | No | Optional | No |
| **deafblind** | Yes | Yes | Yes |

### 5.2 TTS Control Flags

**Frontend State:**
```typescript
const speakIncoming = profileId === "blind";    // Auto-play incoming chat
const wantsTts = profileId === "blind";         // Send tts flag in WS
const showCaptionFeed = profileId === "deaf" || profileId === "mute";
```

**Backend State:**
```python
conn_info: dict = {
    "ws": websocket,
    "profile_type": profile_type,
    "wants_tts": False,  # Can be toggled via set_tts_preference
    "client_id": client_id
}
```

**TTS Decision Logic:**
```python
# When routing chat messages
recv_wants_tts = peer.get("wants_tts", False)
recv_profile = peer.get("profile_type", "deaf")

# TTS if: explicit request OR recipient is blind OR they enabled TTS
tts_for_peer = want_tts or (recv_profile == "blind") or recv_wants_tts

if tts_for_peer:
    asyncio.create_task(_stream_tts_to_ws(peer["ws"], text))
```

---

## 6. Configuration & Environment

**File:** `/backend/app/config.py`

```python
class Settings:
    # API Keys
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_ID: str = os.getenv(
        "ELEVENLABS_VOICE_ID", 
        "21m00Tcm4TlvDq8ikWAM"  # Default voice
    )
    
    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Mobile compatibility
    MOBILE_MODE: bool = os.getenv("MOBILE_MODE", "true").lower() == "true"
    MAX_AUDIO_CHUNK_BYTES: int = int(
        os.getenv("MAX_AUDIO_CHUNK_BYTES", "500000")
    )
```

**Required Environment Variables:**
```bash
ELEVENLABS_API_KEY=sk_...           # ElevenLabs API key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Optional, has default
```

---

## 7. Audio Format & Processing Pipeline

### 7.1 Input Audio Format (Microphone → Backend)

```
WebM / MP4 / M4A (phone compatibility)
↓
Base64 encoded
↓
Sent every 1.5 seconds via WebSocket
↓
Backend: base64 → bytes → Groq/OpenAI Whisper
```

### 7.2 Output Audio Format (Backend → Speaker)

```
Text (from transcript/reply/message)
↓
ElevenLabs TTS API
↓
MP3 (22050 Hz, 32 kbps)
↓
Base64 encoded
↓
Sent via WebSocket as chunks OR returned from /api/tts
↓
Frontend: base64 → bytes → Blob → HTMLAudioElement
```

---

## 8. Error Handling & Fallback

### 8.1 TTS Failures

**Backend:**
```python
except Exception as e:
    print(f"ElevenLabs TTS error: {e}")
    return b""  # Empty bytes on error
```

**Frontend:**
```typescript
postTts(text, voiceId, baseUrl)
  .then(blob => /* play audio */)
  .catch(() => {
    // Silently fail; no fallback for paid TTS
    // Could add: speakGuidance(text) for fallback
  })
```

### 8.2 Guidance Fallback

For guidance text (speakGuidance), no backend required:
```typescript
speakGuidance("Turn camera on to start sign detection");
// Uses Web Speech API directly, no network needed
```

---

## 9. Streaming & Performance Optimizations

### 9.1 ElevenLabs Streaming Benefits

1. **Low Time-to-First-Byte:** Audio starts playing before full text is processed
2. **Memory Efficient:** Chunks streamed as generated, not buffered entirely
3. **Queue Management:** Frontend queues and plays chunks sequentially

### 9.2 WebSocket Streaming

- Chunks sent as JSON over WebSocket
- No separate binary frames needed
- Base64 encoding allows text-only protocol

### 9.3 Client-Side Queue

```typescript
const ttsQueue: string[] = [];
let ttsPlaying = false;

function drainTtsQueue() {
  if (ttsPlaying || ttsQueue.length === 0) return;
  const chunk = ttsQueue.shift();
  ttsPlaying = true;
  const audio = playTtsChunk(chunk);
  audio.onended = () => {
    ttsPlaying = false;
    drainTtsQueue();  // Play next chunk
  };
}
```

---

## 10. File Structure Summary

| Component | Path | Purpose |
|-----------|------|---------|
| **TTS Service** | `/backend/app/services/elevenlabs_tts.py` | ElevenLabs API wrapper |
| **TTS Router** | `/backend/app/routers/tts.py` | HTTP endpoints for TTS |
| **Conversation WS** | `/backend/app/routers/conversation.py` | WebSocket + TTS streaming |
| **Frontend TTS Lib** | `/senseai-frontend/src/lib/tts.ts` | Audio playback & queueing |
| **Frontend API** | `/senseai-frontend/src/lib/api.ts` | HTTP TTS client |
| **LiveWorkspace** | `/senseai-frontend/src/components/LiveWorkspace.tsx` | WS integration & UI |
| **Config** | `/backend/app/config.py` | Environment & API keys |
| **Schemas** | `/backend/app/models/schemas.py` | TTSRequest & QuickReply |

---

## 11. Data Flow Diagram

### Quick Reply Audio (HTTP)
```
User taps "How serious is it?"
  ↓
speakText("Could you tell me how serious this is?")
  ↓
POST /api/tts { text, voice_id }
  ↓
Backend: ElevenLabs API
  ↓
MP3 blob (audio/mpeg)
  ↓
HTMLAudioElement.play()
  ↓
Speaker
```

### Chat Message Audio (WebSocket Streaming)
```
Chat message arrives from remote peer
  ↓
startNewTtsStream() [clear queue]
  ↓
_stream_tts_to_ws() [backend thread]
  ↓
ElevenLabs API → MP3 chunks
  ↓
Send via WS: { type: "tts_audio_chunk", audio_base64 }
  ↓
pushTtsChunk(audioBase64) [queue]
  ↓
drainTtsQueue() [sequential playback]
  ↓
HTMLAudioElement.play()
  ↓
Speaker
```

---

## 12. Key Insights & Design Decisions

1. **Dual TTS Strategy:**
   - ElevenLabs for quality/natural speech in sessions
   - Web Speech for offline-capable guidance

2. **Streaming Over HTTP:**
   - WebSocket chosen for bi-directional real-time flow
   - Base64 simplifies text-only protocol (vs binary WebSocket frames)

3. **Queue-Based Playback:**
   - Handles overlapping chunks gracefully
   - Sequential playback prevents audio overlap
   - Stream IDs ensure late-arriving chunks don't interrupt newer streams

4. **Profile-Aware Defaults:**
   - Blind users get TTS by default
   - Deaf users can opt-in to TTS
   - Backend tracks preferences per connection

5. **Mobile-Friendly:**
   - MP3 format widely supported on phones
   - Lower bitrate (32 kbps) reduces bandwidth
   - Audio chunk size limited to 500KB (configurable)

---

## 13. Current Limitations & Notes

1. **Character Budget:** ElevenLabs free tier = 10,000 chars/month
2. **Single Voice:** Default voice ID is fixed per deployment
3. **No Voice Selection UI:** Voice ID is configurable but not exposed in UI
4. **Fallback Limited:** TTS failures don't have Web Speech fallback yet
5. **One-Way Streaming:** WebSocket TTS is one-way (backend → frontend only)

---

## 14. Testing & Debugging

**Health Check Endpoint:**
```python
GET /health
Response: {
  "status": "ok",
  "services": {
    "elevenlabs": true,
    ...
  }
}
```

**Backend Log Messages:**
```
TTS stream error: [exception details]
Chat TTS: streaming to peer (wants_tts=True, blind=False)
```

**Frontend Console:**
```
[TTS] Decode/play error [error]
[AudioTap] Audio track tapped for AI processing
```

