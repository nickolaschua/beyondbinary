# External Integrations

**Analysis Date:** 2026-02-10

## APIs & External Services

**Speech-to-Text (STT):**
- Groq Whisper API - Fast transcription via Whisper Large v3 Turbo
  - SDK/Client: `groq` SDK 1.0.0
  - Auth: `GROQ_API_KEY` env var
  - File: `backend/app/services/groq_stt.py`
  - Supported formats: webm, mp4, m4a, wav, mp3

- OpenAI Whisper API - Alternative STT provider (drop-in replacement)
  - SDK/Client: `openai` SDK >=1.0.0
  - Auth: `OPENAI_API_KEY` env var
  - File: `backend/app/services/openai_stt.py`

**Text-to-Speech (TTS):**
- ElevenLabs API - Natural speech synthesis
  - SDK/Client: `elevenlabs` SDK
  - Auth: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` env vars
  - File: `backend/app/services/elevenlabs_tts.py`
  - Model: `eleven_multilingual_v2`, streaming + batch modes

**Tone/Emotion Analysis:**
- Hume AI Expression Measurement API - Prosody/emotion from audio
  - SDK/Client: `hume` SDK 0.13.6
  - Auth: `HUME_API_KEY` env var
  - File: `backend/app/services/hume_tone.py`
  - Returns 48 emotion dimensions, 5000ms limit per request
  - Fallback: AFINN text sentiment (`backend/app/services/afinn_fallback.py`)

**Large Language Models:**
- Groq Llama 3.3 70B - Jargon simplification, quick-reply generation
  - SDK/Client: `groq` SDK (shared with STT)
  - Auth: `GROQ_API_KEY` env var
  - File: `backend/app/services/claude_intelligence.py`
  - Model: `llama-3.3-70b-versatile`, JSON output forcing

- Anthropic Claude - Reserved for advanced processing
  - SDK/Client: `anthropic` SDK 0.79.0
  - Auth: `ANTHROPIC_API_KEY` env var
  - Config: `backend/app/config.py` (configured but not actively called)

## Data Storage

**Databases:**
- None - In-memory only (`backend/app/routers/profile.py` line 13: `_profiles = {}`)

**File Storage:**
- Local filesystem only - ML training data in `ml/MP_Data/`, model artifacts in `ml/models/`

**Caching:**
- None currently

## Authentication & Identity

**Auth Provider:**
- None - No user authentication system
- Optional API key for ML WebSocket (`ml/ws_server.py`, query parameter)

**OAuth Integrations:**
- Not detected

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry or equivalent)

**Analytics:**
- Not detected

**Logs:**
- ML service: Python `logging` module (`ml/ws_server.py`)
- Backend: `print()` statements (no structured logging)

## CI/CD & Deployment

**Hosting:**
- Railway - Backend deployment (`backend/Procfile`, `backend/railway.toml`)
- Docker - Ralph automation loop (`Dockerfile`, `docker-compose.yml`)

**CI Pipeline:**
- Not detected (no `.github/workflows/` found)

## Environment Configuration

**Development:**
- Required env vars: `GROQ_API_KEY`, `HUME_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`
- Secrets location: `.env` files (gitignored), template at `backend/.env.example`
- ML module: No `.env.example` (env vars documented in `ml/utils.py` lines 78-91)

**Production:**
- Secrets management: Railway environment variables (backend)
- CORS: Wildcard `["*"]` default; set `FRONTEND_ORIGIN` for production

## WebSocket Protocols

**Conversation Intelligence:**
- Endpoint: `/ws/conversation` (Backend FastAPI)
- File: `backend/app/routers/conversation.py`
- Protocol: Audio chunks (base64) in, transcripts/tone/simplified text/TTS audio out
- Documentation: `docs/WEBSOCKET.md`

**Sign Detection:**
- Endpoint: `/ws/sign-detection` (ML FastAPI)
- File: `ml/ws_server.py`
- Protocol: Base64 JPEG frames in, sign predictions + confidence out
- Auth: Optional API key via query parameter

## API Routes

**Backend REST:**
- `POST /api/tts` - Text-to-speech (`backend/app/routers/tts.py`)
- `POST /api/profile` - Create profile (`backend/app/routers/profile.py`)
- `GET /api/profile/{user_name}` - Get profile (`backend/app/routers/profile.py`)
- `GET /braille/display` - Braille translation (`backend/app/routers/braille.py`)
- `GET /health` - Health check (`backend/app/main.py`)

**Frontend API Client:**
- `senseai-frontend/src/lib/api.ts` - HTTP wrappers (checkBackendHealth, postTts, createProfile, getProfile)
- `senseai-frontend/src/lib/constants.ts` - API_URL (`http://localhost:8001`), WS_URL (`ws://localhost:8001`)

---

*Integration audit: 2026-02-10*
*Update when adding/removing external services*
