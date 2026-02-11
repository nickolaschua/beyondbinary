# BeyondBinary

Accessibility-first communication platform for deaf, blind, deafblind, and mute users. Real-time ASL sign language detection, voice-to-text, text-to-speech, tone analysis, braille output, and video calling.

## Architecture

```
senseai-frontend/     Next.js 16 + React 19 frontend (TypeScript)
backend/              FastAPI backend — TTS, STT, tone, braille, AI conversation
ml/                   SenseAI ML pipeline — ASL detection (MediaPipe + LSTM)
```

### ML Pipeline (`ml/`)

Webcam frames → MediaPipe Holistic landmarks → 30-frame sliding window → LSTM classifier → predicted ASL sign. Served over WebSocket for real-time inference.

- **Python 3.12** (MediaPipe 0.10.21 requires 3.9–3.12)
- **TensorFlow 2.16.2**, numpy <2, opencv, scikit-learn
- 131+ tests via pytest
- WebSocket protocol: see `docs/WEBSOCKET.md`

### Backend (`backend/`)

FastAPI server providing:

- **Sign detection** — proxies to ML WebSocket server
- **Speech-to-text** — Groq Whisper + OpenAI fallback
- **Text-to-speech** — ElevenLabs with Web Speech API fallback
- **Tone analysis** — Hume AI prosody + AFINN sentiment fallback
- **Braille translation** — Grade 1 UEB output
- **AI conversation** — Claude intelligence for contextual responses

### Frontend (`senseai-frontend/`)

Next.js app with accessibility-driven UI:

- **Onboarding** — profile selection (deaf, blind, deafblind, mute)
- **Live workspace** — real-time session with ASL detection, captions, tone display
- **Video calling** — WebRTC peer-to-peer
- **Braille display** — visual braille cell rendering
- **Voice commands** — hands-free navigation
- **Audio guidance** — TTS page hints for blind users

## Quick Start

### ML Pipeline

```bash
# Create Python 3.12 venv (system Python 3.13 is NOT compatible)
py -3.12 -m venv ml/venv
ml\venv\Scripts\pip.exe install -r ml/requirements.txt

# Verify environment
cd ml && venv\Scripts\python.exe test_setup.py

# Start ML WebSocket server
cd ml && venv\Scripts\python.exe ws_server.py
```

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\pip.exe install -r requirements.txt

# Copy .env.example to .env and fill in API keys
# Required: GROQ_API_KEY, ELEVENLABS_API_KEY, ANTHROPIC_API_KEY, HUME_API_KEY
python run_dev.sh
```

### Frontend

```bash
cd senseai-frontend
npm install
npm run dev
```

## Key Dependencies

| Package | Version | Component | Purpose |
|---------|---------|-----------|---------|
| mediapipe | 0.10.21 | ML | Last version with `mp.solutions.holistic` |
| tensorflow | 2.16.2 | ML | LSTM model (numpy <2 constraint) |
| fastapi | 0.128.6 | ML + Backend | WebSocket / REST server |
| next | 16.1.6 | Frontend | React framework |
| react | 19.2.3 | Frontend | UI library |

## Documentation

- `docs/WEBSOCKET.md` — ML WebSocket protocol specification
- `docs/BACKEND_INTEGRATION.md` — Frontend ↔ Backend integration guide
- `backend/README.md` — Backend API reference and setup
