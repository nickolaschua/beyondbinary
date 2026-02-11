# BeyondBinary

Accessibility-first communication platform that bridges the gap between deaf, blind, deafblind, and mute users through real-time AI. Combines ASL sign language detection, speech-to-text, text-to-speech, emotional tone analysis, braille output, and peer-to-peer video calling into a single live workspace.

## The Problem

Current assistive technologies focus on single-modality solutions — speech-to-text, basic sign recognition, or simple navigation aids — that don't address the complex, multi-layered needs of users with disabilities. These fragmented tools fail to account for regional sign language variations, contextual nuances, and the reality that many users need multiple modalities working together simultaneously.

BeyondBinary tackles this by combining vision, audio, text, haptics, and AI into one cohesive system that adapts to individual needs. A deaf user gets large captions with emotional tone indicators. A blind user gets speech narration and braille. A deafblind user gets both. Rather than forcing users to stitch together separate tools, BeyondBinary provides a single workspace where all modalities work in concert.

## How It Works

```
                    ┌──────────────────────────────────────────┐
                    │           Live Workspace (Frontend)       │
                    │                                          │
                    │  ┌─────────┐  ┌──────────┐  ┌────────┐  │
                    │  │ Webcam  │  │ Captions  │  │Braille │  │
                    │  │ + Sign  │  │ + Tone    │  │Display │  │
                    │  │Detection│  │ Feed      │  │(6-dot) │  │
                    │  └────┬────┘  └─────┬─────┘  └───┬────┘  │
                    │       │             │            │        │
                    └───────┼─────────────┼────────────┼────────┘
                            │             │            │
              ┌─────────────▼─┐     ┌─────▼──────┐    │
              │  ML Server    │     │  Backend    │    │
              │  MediaPipe +  │     │  Groq STT   │    │
              │  LSTM → Sign  │     │  Hume Tone  │    │
              │  (port 8001)  │     │  11Labs TTS │    │
              └───────────────┘     │  Groq LLM   │    │
                                    │  (port 8000)│    │
                                    └─────────────┘    │
                                          │            │
                                    ┌─────▼────────────▼────┐
                                    │   UEB Grade 1 Braille  │
                                    │   Translation Engine   │
                                    └────────────────────────┘
```

## Accessibility Profiles

Users select a profile during onboarding. Each profile activates a different combination of input/output channels:

| Profile | Receives | Sends | Special Features |
|---------|----------|-------|------------------|
| **Deaf** | Large captions, sign interpretation, tone indicators | Text, message cards | Tone emoji badges, visual-first layout |
| **Blind** | Speech narration, braille output, tone identification | Text-to-speech | Audio guidance on every page, ElevenLabs voice |
| **Deafblind** | Braille (always-on), optional audio, tone labels | Text-to-speech, message cards | 12-cell braille display, extra-large text |
| **Mute** | Captions, sign interpretation, audio context | Text-to-speech, text output | Quick reply buttons for fast responses |

## Features

### ASL Sign Detection
Real-time detection of 12 ASL signs via webcam at 5 FPS:

> Hello, Thank You, Help, Yes, No, Please, Sorry, I Love You, Stop, More, How Are You, Good

Pipeline: webcam frame → MediaPipe Holistic (1662 landmarks) → 30-frame sliding window → LSTM classifier → stability filter (5 consecutive frames) → confirmed sign.

### Voice + Tone Intelligence
- **Speech-to-text** via Groq Whisper (~200ms latency), OpenAI Whisper fallback
- **Emotional tone analysis** via Hume AI prosody (~300ms), AFINN sentiment fallback
- **Text-to-speech** via ElevenLabs multilingual v2, Web Speech API fallback
- **Jargon simplification** and **quick reply generation** via Groq Llama 3.3 70B

### Braille Display
Visual 6-dot UEB Grade 1 braille cells rendered in the browser. 12-cell scrolling display converts conversation text to braille in real-time. Supports a-z, 0-9, and common punctuation with number indicator prefix.

### Video Calling
WebRTC peer-to-peer video with STUN/TURN relay. Signaling through backend WebSocket. Camera toggle with local and remote stream display.

### Onboarding Flow
Guided 4-step onboarding: profile selection, accessibility settings (text size, high contrast), system checks (camera/mic permissions, backend health), and summary confirmation. Voice command navigation and ElevenLabs audio prompts throughout.

## Tech Stack

| Layer | Technology | Port |
|-------|-----------|------|
| Frontend | Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4 | 3000 |
| Backend | FastAPI 0.128, Python 3.12, Pydantic 2 | 8000 |
| ML Server | TensorFlow 2.16, MediaPipe 0.10.21, LSTM | 8001 |

### External Services

| Service | Provider | Purpose | Fallback |
|---------|----------|---------|----------|
| Speech-to-text | Groq (Whisper Large v3 Turbo) | Audio transcription | OpenAI Whisper |
| Text-to-speech | ElevenLabs (multilingual v2) | Voice synthesis | Web Speech API (browser) |
| Tone analysis | Hume AI (Expression Measurement) | Prosody/emotion from audio | AFINN text sentiment |
| Intelligence | Groq (Llama 3.3 70B) | Jargon simplification, quick replies | -- |

## Quick Start

### 1. ML Server

```bash
# Requires Python 3.12 (3.13 is NOT compatible with MediaPipe)
py -3.12 -m venv ml/venv
ml\venv\Scripts\pip.exe install -r ml/requirements.txt

# Verify environment
cd ml && venv\Scripts\python.exe test_setup.py

# Start WebSocket server on port 8001
cd ml && venv\Scripts\python.exe -m uvicorn ws_server:app --host 0.0.0.0 --port 8001
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\pip.exe install -r requirements.txt

# Copy .env.example and fill in your API keys
cp .env.example .env
# Required: GROQ_API_KEY, ELEVENLABS_API_KEY, HUME_API_KEY
# Optional: OPENAI_API_KEY (STT fallback), ANTHROPIC_API_KEY

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend

```bash
cd senseai-frontend
npm install
npm run dev
```

Open `http://localhost:3000` → select your accessibility profile → enter live workspace.

## Project Structure

```
beyondbinary/
├── ml/                              # ASL sign detection pipeline
│   ├── ws_server.py                 # FastAPI WebSocket inference server
│   ├── utils.py                     # Shared constants, MediaPipe extraction, stability filter
│   ├── train_model.py               # LSTM model training script
│   ├── augment.py                   # Data augmentation for training robustness
│   ├── collect_data.py              # Webcam-based training data collection
│   ├── verify_data.py               # Dataset validation utilities
│   ├── transformer_model.py         # Experimental transformer architecture
│   ├── preprocess_for_colab.py      # Colab-compatible data preprocessing
│   ├── requirements.txt             # Python dependencies (pinned versions)
│   └── tests/                       # 131+ pytest tests
│
├── backend/                         # FastAPI API gateway + service orchestration
│   ├── app/
│   │   ├── main.py                  # App entry point, CORS, router registration
│   │   ├── config.py                # Environment-based settings
│   │   ├── models/
│   │   │   └── schemas.py           # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── conversation.py      # WebSocket: real-time audio + AI processing
│   │   │   ├── tts.py               # REST: text-to-speech
│   │   │   ├── profile.py           # REST: user profile CRUD
│   │   │   ├── braille.py           # REST: braille translation
│   │   │   └── sign_detection.py    # WebSocket: sign detection proxy
│   │   └── services/
│   │       ├── groq_stt.py          # Groq Whisper transcription
│   │       ├── openai_stt.py        # OpenAI Whisper fallback
│   │       ├── hume_tone.py         # Hume AI prosody analysis
│   │       ├── elevenlabs_tts.py    # ElevenLabs voice synthesis
│   │       ├── claude_intelligence.py  # Groq LLM: simplification + quick replies
│   │       ├── afinn_fallback.py    # Text-based sentiment fallback
│   │       ├── braille_ueb.py       # UEB Grade 1 braille translation
│   │       ├── tone_mapper.py       # 48 emotion dimensions → 8 labels
│   │       ├── tone_aggregator.py   # Moving average of tone samples
│   │       └── prosody_buffer.py    # Audio buffering for batched tone analysis
│   ├── .env.example                 # API key template
│   ├── requirements.txt
│   ├── Procfile                     # Railway deployment
│   └── railway.toml                 # Railway config
│
├── senseai-frontend/                # Next.js accessible UI
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           # Root layout + AccessibilityBoot
│   │   │   ├── page.tsx             # Redirects to /onboarding
│   │   │   ├── onboarding/          # 4-step profile creation flow
│   │   │   ├── start/               # Room/session setup
│   │   │   ├── live/
│   │   │   │   ├── deaf/            # Visual-first workspace
│   │   │   │   ├── blind/           # Audio-first workspace
│   │   │   │   ├── deafblind/       # Braille + audio workspace
│   │   │   │   └── mute/            # Text + TTS workspace
│   │   │   ├── session/[id]/summary/ # Post-session summary
│   │   │   └── settings/            # User preferences
│   │   ├── components/
│   │   │   ├── LiveWorkspace.tsx     # Main workspace (sign detection, captions, chat, video)
│   │   │   ├── VideoCall.tsx         # WebRTC peer-to-peer video
│   │   │   ├── BrailleCell.tsx       # 6-dot braille cell display
│   │   │   ├── AudioAssistButton.tsx # Audio recording/narration
│   │   │   ├── AccessibilityBoot.tsx # Accessibility initialization
│   │   │   └── ToggleSwitch.tsx      # Accessible toggle component
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts       # WebSocket with auto-reconnect
│   │   │   ├── useWebRTC.ts          # WebRTC peer connection setup
│   │   │   ├── usePageAudioGuide.ts  # Page-level audio narration
│   │   │   └── useVoiceCommands.ts   # Speech recognition commands
│   │   ├── lib/
│   │   │   ├── api.ts               # REST client (health, TTS, profile)
│   │   │   ├── constants.ts         # API_URL, WS_URL configuration
│   │   │   ├── profile.ts           # Profile type definitions + channel config
│   │   │   ├── session.ts           # Session state management
│   │   │   ├── tts.ts               # TTS audio playback
│   │   │   ├── toneDisplay.ts       # Tone emotion visualization
│   │   │   └── accessibility.ts     # Accessibility helpers
│   │   └── braille/
│   │       └── mapping.ts           # UEB character → 6-dot pattern mapping
│   ├── package.json
│   └── tsconfig.json
│
└── docs/
    ├── WEBSOCKET.md                 # ML WebSocket protocol spec
    └── BACKEND_INTEGRATION.md       # Frontend ↔ Backend integration guide
```

## Running Tests

```bash
# ML pipeline (131+ tests)
ml\venv\Scripts\python.exe -m pytest ml/tests/ -v
```

## Documentation

- [`docs/WEBSOCKET.md`](docs/WEBSOCKET.md) — ML WebSocket message types and protocol
- [`docs/BACKEND_INTEGRATION.md`](docs/BACKEND_INTEGRATION.md) — Frontend ↔ Backend API reference
- [`backend/README.md`](backend/README.md) — Backend setup and API endpoints
- [`backend/.env.example`](backend/.env.example) — Required API keys and configuration

## License

All rights reserved.
