# Technology Stack

**Analysis Date:** 2026-02-10

## Languages

**Primary:**
- Python 3.12 - Backend API, ML pipeline, all server-side logic
- TypeScript 5.9.3 - Frontend React application (`senseai-frontend/tsconfig.json`)

**Secondary:**
- JavaScript (ES6+) - Video call POC, build scripts (`video-call-poc/package.json`)

## Runtime

**Environment:**
- Python 3.12 venv at `ml/venv/` (never use system Python 3.13)
- Node.js 20 - Docker base image (`Dockerfile` line 1: `FROM node:20-slim`)
- MediaPipe 0.10.21 - Last version with `mp.solutions.holistic` (0.10.30+ removed it)

**Package Manager:**
- pip - Python packages (`backend/requirements.txt`, `ml/requirements.txt`)
- npm - Node.js packages (`senseai-frontend/package.json`, `video-call-poc/package.json`)
- Lockfile: `senseai-frontend/package-lock.json` present

## Frameworks

**Core:**
- FastAPI 0.128.5 - Backend REST/WebSocket API (`backend/requirements.txt`, `backend/app/main.py`)
- FastAPI 0.128.6 - ML WebSocket server (`ml/requirements.txt`, `ml/ws_server.py`)
- Next.js 16.1.6 - React meta-framework (`senseai-frontend/package.json`)
- React 19.2.3 - UI library (`senseai-frontend/package.json`)

**Testing:**
- pytest - Python test framework (131+ tests in `ml/tests/`)
- ESLint 9 - TypeScript linting (`senseai-frontend/eslint.config.mjs`)

**Build/Dev:**
- Uvicorn 0.40.0 - ASGI server (`backend/requirements.txt`, `ml/requirements.txt`)
- Tailwind CSS 4 - Utility-first styling (`senseai-frontend/package.json`)
- PostCSS 4 - CSS processing (`senseai-frontend/package.json`)

## Key Dependencies

**Critical (ML & Computer Vision):**
- TensorFlow 2.16.2 - Deep learning, LSTM model (pinned for numpy<2 compat) - `ml/requirements.txt`
- MediaPipe 0.10.21 - Hand/pose/face landmark detection - `ml/requirements.txt`
- scikit-learn 1.6.1 - ML utilities - `ml/requirements.txt`
- OpenCV 4.11.0.86 - Image processing - `ml/requirements.txt`
- NumPy 1.26.4 - Numerical computing (constrained <2 by mediapipe) - `ml/requirements.txt`

**Critical (AI Services):**
- Groq SDK 1.0.0 - LLM inference + Whisper STT - `backend/requirements.txt`
- Hume SDK 0.13.6 - Prosody/emotion analysis - `backend/requirements.txt`
- ElevenLabs SDK - Text-to-speech - `backend/requirements.txt`
- OpenAI SDK >=1.0.0 - Alternative Whisper STT - `backend/requirements.txt`
- Anthropic SDK 0.79.0 - Claude API (configured, reserved) - `backend/requirements.txt`

**Infrastructure:**
- Pydantic 2.12.5 - Data validation/serialization - `backend/requirements.txt`
- websockets 16.0 (ML) / 13.1 (Backend) - WebSocket protocol - `ml/requirements.txt`, `backend/requirements.txt`
- python-dotenv 1.2.1 - Environment variable loading - `backend/requirements.txt`

**Frontend:**
- lucide-react 0.563.0 - Icon library - `senseai-frontend/package.json`
- clsx 2.1.1 - Conditional classnames - `senseai-frontend/package.json`

## Configuration

**Environment:**
- `.env` files loaded via python-dotenv (`backend/app/config.py`)
- Template: `backend/.env.example` (documents all required API keys)
- Required keys: `GROQ_API_KEY`, `HUME_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`
- Optional keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `FRONTEND_ORIGIN`, `MOBILE_MODE`
- Frontend constants: `senseai-frontend/src/lib/constants.ts` (API_URL, WS_URL)

**Build:**
- `senseai-frontend/tsconfig.json` - TypeScript strict mode
- `senseai-frontend/next.config.ts` - Next.js configuration
- `senseai-frontend/eslint.config.mjs` - ESLint 9 flat config

## Platform Requirements

**Development:**
- Windows environment (primary development platform)
- Python 3.12 venv required (system Python 3.13 incompatible with mediapipe)
- Node.js 20+ for frontend

**Production:**
- Docker container (`Dockerfile`, `docker-compose.yml`) for Ralph automation loop
- Railway deployment (`backend/Procfile`, `backend/railway.toml`) for backend
- Vercel-compatible Next.js frontend

---

*Stack analysis: 2026-02-10*
*Update after major dependency changes*
