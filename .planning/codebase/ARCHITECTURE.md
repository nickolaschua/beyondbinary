# Architecture

**Analysis Date:** 2026-02-10

## Pattern Overview

**Overall:** Event-Driven WebSocket Hub with Specialized Microservices

**Key Characteristics:**
- Three independent services (Frontend, Backend API, ML Service) communicating via WebSocket/REST
- Real-time bidirectional WebSocket for low-latency accessibility features
- Profile-driven rendering: same backend serves Deaf, Blind, DeafBlind, and Mute users
- External AI API orchestration (Groq, Hume, ElevenLabs, OpenAI)

## Layers

**Frontend - Presentation Layer (`senseai-frontend/src/app/`):**
- Purpose: Profile-specific user interfaces with real-time updates
- Contains: Page components for each profile type (deaf, blind, deafblind, mute)
- Depends on: WebSocket hooks, utility libraries, backend API
- Used by: End users via browser

**Frontend - Component Layer (`senseai-frontend/src/components/`):**
- Purpose: Reusable UI components
- Contains: LiveWorkspace, BrailleCell, AudioAssistButton, AccessibilityBoot, ToggleSwitch
- Depends on: Hooks layer, lib utilities
- Used by: Page components

**Frontend - Hook Layer (`senseai-frontend/src/hooks/`):**
- Purpose: State management and side-effect encapsulation
- Contains: useWebSocket (auto-reconnect), usePageAudioGuide, useVoiceCommands
- Depends on: Browser APIs, WebSocket protocol
- Used by: Components

**Frontend - Utility Layer (`senseai-frontend/src/lib/`):**
- Purpose: API clients, constants, helpers
- Contains: api.ts, constants.ts, profile.ts, session.ts, tts.ts, accessibility.ts
- Depends on: Backend REST endpoints
- Used by: Hooks, components

**Backend - Router/Controller Layer (`backend/app/routers/`):**
- Purpose: HTTP/WebSocket endpoint definitions
- Contains: conversation.py, tts.py, profile.py, sign_detection.py, braille.py
- Depends on: Service layer for business logic
- Used by: Frontend via HTTP/WebSocket

**Backend - Service Layer (`backend/app/services/`):**
- Purpose: Business logic and external API integration
- Contains: groq_stt.py, openai_stt.py, hume_tone.py, elevenlabs_tts.py, claude_intelligence.py, tone_aggregator.py, tone_mapper.py, prosody_buffer.py, braille_ueb.py, afinn_fallback.py
- Depends on: External AI APIs, config
- Used by: Router layer

**Backend - Model Layer (`backend/app/models/`):**
- Purpose: Request/response validation
- Contains: schemas.py (Pydantic models: ProfileCreate, TTSRequest, ProfileResponse)
- Depends on: Pydantic
- Used by: Router layer

**ML - WebSocket Handler (`ml/ws_server.py`):**
- Purpose: Real-time sign language detection server
- Contains: Frame reception, inference pipeline, stability filtering
- Depends on: Utils layer, TensorFlow model
- Used by: Frontend via WebSocket

**ML - Inference Pipeline (`ml/utils.py`):**
- Purpose: Shared constants, MediaPipe extraction, model loading, stability filter
- Contains: extract_keypoints(), StabilityFilter, load_model(), ACTIONS, SEQUENCE_LENGTH
- Depends on: TensorFlow, MediaPipe, NumPy
- Used by: WebSocket handler, training scripts

## Data Flow

**Sign Detection Flow (Real-time):**

1. Frontend captures camera frame as JPEG
2. Frame sent as base64 via WebSocket to ML server (`/ws/sign-detection`)
3. MediaPipe Holistic extracts 1662 keypoints (`ml/utils.py:extract_keypoints`)
4. 30-frame sequence fed to LSTM model (`ml/models/action_model.h5`)
5. StabilityFilter deduplicates consecutive predictions
6. Response: sign prediction + confidence score sent to frontend
7. Frontend renders sign label + plays audio feedback

**Conversation Intelligence Flow (Streaming):**

1. Frontend captures 3-second audio chunks
2. Audio sent as base64 via WebSocket to backend (`/ws/conversation`)
3. Groq Whisper transcribes audio (`backend/app/services/groq_stt.py`)
4. Parallel processing:
   - Hume AI analyzes prosody/emotion from audio (`backend/app/services/hume_tone.py`)
   - Tone mapper reduces 48 dimensions to 8 labels (`backend/app/services/tone_mapper.py`)
   - Groq LLM simplifies jargon + generates quick replies (`backend/app/services/claude_intelligence.py`)
5. ToneAggregator maintains moving average (`backend/app/services/tone_aggregator.py`)
6. Results streamed back: transcript -> tone_update -> simplified text -> quick_replies

**Accessibility Output (Profile-driven):**

1. Backend results arrive at frontend via WebSocket
2. Profile type determines which channels are active
3. Deaf: Captions + Braille display + Quick-replies + Tone badges
4. Blind: Audio narration + TTS expansion + Audio summaries
5. DeafBlind: Braille output + haptic feedback patterns
6. Mute: Sign detection input + text-to-speech output

**State Management:**
- Backend: In-memory profiles (`_profiles` dict), per-connection conversation history
- Frontend: React state in components, session storage for profile
- ML: Per-connection frame buffer (30-frame sliding window)
- No persistent database

## Key Abstractions

**Service Pattern (Backend):**
- Purpose: Encapsulate external API calls with error handling and fallbacks
- Examples: `backend/app/services/groq_stt.py`, `backend/app/services/hume_tone.py`, `backend/app/services/elevenlabs_tts.py`
- Pattern: Async functions with try/catch, graceful degradation on API failure

**StabilityFilter (ML):**
- Purpose: Deduplicate consecutive sign predictions for smooth UX
- Location: `ml/utils.py`
- Pattern: Sliding window with configurable threshold and stability count

**ToneAggregator (Backend):**
- Purpose: Moving average of emotion dimensions across utterances
- Location: `backend/app/services/tone_aggregator.py`
- Pattern: Dataclass-based samples, windowed aggregation

**ProsodyBuffer (Backend):**
- Purpose: Buffer audio chunks for batched tone analysis
- Location: `backend/app/services/prosody_buffer.py`
- Pattern: Async accumulator with time/size triggers

**Profile-Channel Config:**
- Purpose: Declare which output channels are active per profile type
- Location: `backend/app/routers/profile.py` (CHANNEL_CONFIG)
- Pattern: Dict mapping profile type to enabled feature flags

## Entry Points

**Frontend Entry:**
- Location: `senseai-frontend/src/app/layout.tsx` (root layout + AccessibilityBoot)
- Triggers: Browser navigation
- Flow: `/` redirects to `/onboarding` -> profile creation -> `/start` -> `/live/[profile]`

**Backend Entry:**
- Location: `backend/app/main.py` (FastAPI app init, CORS, router registration)
- Triggers: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Responsibilities: Mount routers, configure CORS, health endpoint

**ML Entry:**
- Location: `ml/ws_server.py` (FastAPI WebSocket with lifespan model loading)
- Triggers: `uvicorn ws_server:app --host 0.0.0.0 --port 8001`
- Responsibilities: Load LSTM model on startup, handle frame-by-frame inference

**Training/Data Entry:**
- `ml/train_model.py` - LSTM training with argparse CLI
- `ml/collect_data.py` - Real-time keypoint collection
- `ml/augment.py` - Data augmentation pipeline

## Error Handling

**Strategy:** Service-level try/catch with graceful degradation

**Patterns:**
- External API failures caught per-service, return None/fallback values
- Hume tone -> falls back to AFINN text sentiment (`backend/app/services/afinn_fallback.py`)
- WebSocket errors logged and connection cleaned up in finally blocks
- Broad `except Exception` used in many places (noted as concern)

## Cross-Cutting Concerns

**Logging:**
- ML service: Python `logging` module with structured output
- Backend: `print()` statements (inconsistent, should migrate to logging)

**Validation:**
- Pydantic models for REST endpoints (`backend/app/models/schemas.py`)
- No schema validation for WebSocket messages (JSON parsed manually)

**CORS:**
- FastAPI CORSMiddleware (`backend/app/main.py` lines 32-49)
- Default: wildcard `["*"]`; configurable via `FRONTEND_ORIGIN` env var
- Mobile PWA support: `capacitor://localhost`, `ionic://localhost`

**Real-time Communication:**
- WebSocket with auto-reconnect (frontend: exponential backoff, 5 attempts)
- `senseai-frontend/src/hooks/useWebSocket.ts`

---

*Architecture analysis: 2026-02-10*
*Update when major patterns change*
