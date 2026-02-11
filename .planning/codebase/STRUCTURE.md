# Codebase Structure

**Analysis Date:** 2026-02-10

## Directory Layout

```
beyondbinary/
├── backend/                    # FastAPI backend orchestration server
│   ├── app/
│   │   ├── main.py            # Entry point, CORS, router registration
│   │   ├── config.py          # Environment-based settings
│   │   ├── models/
│   │   │   └── schemas.py     # Pydantic request/response models
│   │   ├── routers/           # API endpoint handlers
│   │   │   ├── conversation.py    # WebSocket: audio + AI processing
│   │   │   ├── sign_detection.py  # Sign detection proxy
│   │   │   ├── tts.py            # Text-to-speech REST
│   │   │   ├── profile.py        # User profile management
│   │   │   └── braille.py        # Braille translation REST
│   │   └── services/          # Business logic & external APIs
│   │       ├── groq_stt.py        # Groq Whisper STT + LLM
│   │       ├── openai_stt.py      # OpenAI Whisper STT
│   │       ├── claude_intelligence.py  # Groq LLM simplification
│   │       ├── hume_tone.py       # Hume AI prosody analysis
│   │       ├── elevenlabs_tts.py  # ElevenLabs TTS
│   │       ├── afinn_fallback.py  # Fallback sentiment analysis
│   │       ├── braille_ueb.py     # UEB braille translation
│   │       ├── tone_mapper.py     # 48 dimensions -> 8 labels
│   │       ├── tone_aggregator.py # Moving average of tone samples
│   │       └── prosody_buffer.py  # Audio buffering for tone
│   ├── requirements.txt       # Python dependencies (39 packages)
│   ├── .env.example           # API key template
│   ├── Procfile               # Railway deployment
│   ├── railway.toml           # Railway config
│   └── test_*.py              # Backend test files (7 files)
│
├── ml/                        # Sign language ML pipeline
│   ├── ws_server.py           # WebSocket server (port 8001)
│   ├── train_model.py         # LSTM training script
│   ├── utils.py               # Shared constants & functions
│   ├── augment.py             # Data augmentation
│   ├── collect_data.py        # Keypoint collection tool
│   ├── conftest.py            # Root pytest config
│   ├── models/
│   │   ├── action_model.h5    # Trained LSTM (3 layers, 10 classes)
│   │   └── actions.npy        # Class label mappings
│   ├── MP_Data/               # Training dataset (keypoints)
│   │   └── [10 actions]/      # 60 sequences x 30 frames each
│   ├── tests/                 # 131+ pytest tests
│   │   ├── conftest.py        # Fixtures (MockLandmark, etc.)
│   │   ├── test_augment.py
│   │   ├── test_collect_*.py
│   │   ├── test_decode_frame*.py
│   │   ├── test_extract_keypoints.py
│   │   ├── test_load_data.py
│   │   ├── test_train_*.py
│   │   ├── test_ws_*.py
│   │   ├── test_utils_*.py
│   │   └── test_verify_cli.py
│   ├── requirements.txt       # ML dependencies (TF, MediaPipe, etc.)
│   └── venv/                  # Python 3.12 virtual environment
│
├── senseai-frontend/          # Next.js 16 React frontend
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── layout.tsx     # Root layout + AccessibilityBoot
│   │   │   ├── page.tsx       # Redirect to /onboarding
│   │   │   ├── onboarding/page.tsx  # Profile creation
│   │   │   ├── start/page.tsx       # Room/session setup
│   │   │   ├── live/
│   │   │   │   ├── deaf/page.tsx
│   │   │   │   ├── blind/page.tsx
│   │   │   │   ├── deafblind/page.tsx
│   │   │   │   └── mute/page.tsx
│   │   │   ├── session/[id]/summary/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── components/        # Reusable React components
│   │   │   ├── LiveWorkspace.tsx      # Main workspace (612 lines)
│   │   │   ├── AccessibilityBoot.tsx  # Init accessibility
│   │   │   ├── AudioAssistButton.tsx  # Audio narration
│   │   │   ├── BrailleCell.tsx        # Braille cell display
│   │   │   └── ToggleSwitch.tsx       # Accessible toggle
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useWebSocket.ts        # WebSocket + auto-reconnect
│   │   │   ├── usePageAudioGuide.ts   # Page audio descriptions
│   │   │   └── useVoiceCommands.ts    # Speech recognition
│   │   ├── lib/               # Utilities
│   │   │   ├── api.ts             # HTTP fetch wrappers
│   │   │   ├── constants.ts       # API_URL, WS_URL config
│   │   │   ├── profile.ts        # Profile type helpers
│   │   │   ├── session.ts        # Session state
│   │   │   ├── tts.ts            # TTS audio playback
│   │   │   └── accessibility.ts   # A11y helpers
│   │   ├── braille/
│   │   │   └── mapping.ts        # UEB character mappings
│   │   └── globals.css        # Tailwind styles
│   ├── public/                # Static assets
│   ├── package.json           # Dependencies
│   ├── next.config.ts         # Next.js config
│   ├── tsconfig.json          # TypeScript (strict mode)
│   └── eslint.config.mjs      # ESLint 9 flat config
│
├── video-call-poc/            # WebRTC video calling proof-of-concept
│   ├── client/
│   │   ├── main.js            # Client entry point
│   │   ├── peer.js            # WebRTC peer connection
│   │   ├── signaling.js       # WebSocket signaling
│   │   ├── media.js           # Camera/mic capture
│   │   ├── ai/                # AI integrations (tone, TTS, braille)
│   │   └── ui/                # UI components (captions, chat, controls)
│   └── server/                # Signaling server (Node.js + Express)
│
├── docs/                      # Project documentation
│   ├── WEBSOCKET.md           # ML WebSocket protocol spec
│   ├── BACKEND_INTEGRATION.md # Backend service guide
│   ├── augmentation-changes.md # ML augmentation techniques
│   ├── PRD.md                 # Product requirements
│   └── TODO.md                # Ralph automation tasks
│
├── scripts/ralph/             # Ralph automation loop
│   ├── ralph.sh               # Main loop (spawns Claude Code)
│   └── CLAUDE.md              # Claude Code instructions
│
├── .planning/                 # GSD planning documents
│   └── codebase/              # Codebase analysis (this folder)
│
├── .claude/                   # Claude Code configuration
│   ├── settings.local.json
│   ├── agents/                # Custom AI agents
│   ├── commands/              # Custom commands
│   └── skills/                # Custom skills
│
├── README.md                  # Quick start guide
├── Dockerfile                 # Container image (Ralph)
├── docker-compose.yml         # Docker services
├── Makefile                   # Make targets (ralph-once, ralph-afk)
└── .gitignore                 # Git ignore patterns
```

## Directory Purposes

**backend/app/routers/:**
- Purpose: API endpoint definitions (REST + WebSocket)
- Contains: One file per feature domain
- Key files: `conversation.py` (527 lines, main WebSocket handler), `profile.py`, `tts.py`, `braille.py`

**backend/app/services/:**
- Purpose: Business logic and external API integrations
- Contains: One service per external API or domain concept
- Key files: `groq_stt.py`, `hume_tone.py`, `elevenlabs_tts.py`, `tone_aggregator.py`

**ml/tests/:**
- Purpose: Comprehensive test suite for ML pipeline
- Contains: 18+ test files, 131+ tests
- Key files: `conftest.py` (fixtures), `test_ws_*.py` (WebSocket tests), `test_extract_keypoints.py`

**senseai-frontend/src/app/live/:**
- Purpose: Profile-specific live workspace pages
- Contains: One page per accessibility profile (deaf, blind, deafblind, mute)
- Key files: Each `page.tsx` renders LiveWorkspace with profile-specific config

**senseai-frontend/src/hooks/:**
- Purpose: Custom React hooks for state and side effects
- Contains: WebSocket management, audio guides, voice commands
- Key files: `useWebSocket.ts` (auto-reconnect with exponential backoff)

## Key File Locations

**Entry Points:**
- `backend/app/main.py` - Backend FastAPI entry (port 8000)
- `ml/ws_server.py` - ML WebSocket server entry (port 8001)
- `senseai-frontend/src/app/layout.tsx` - Frontend root layout
- `senseai-frontend/src/app/page.tsx` - Redirects to /onboarding

**Configuration:**
- `backend/app/config.py` - Backend environment settings
- `backend/.env.example` - API key template
- `senseai-frontend/src/lib/constants.ts` - Frontend API URLs
- `senseai-frontend/tsconfig.json` - TypeScript strict config
- `ml/utils.py` (lines 78-91) - ML environment variables

**Core Logic:**
- `backend/app/routers/conversation.py` - Conversation WebSocket (527 lines)
- `backend/app/services/` - All external API integrations
- `ml/utils.py` - MediaPipe extraction, model loading, stability filter
- `senseai-frontend/src/components/LiveWorkspace.tsx` - Main UI workspace (612 lines)

**Testing:**
- `ml/tests/` - 131+ ML tests
- `ml/conftest.py` - Root pytest config (patches mediapipe)
- `ml/tests/conftest.py` - Test fixtures
- `backend/test_*.py` - 7 backend test files

**Documentation:**
- `docs/WEBSOCKET.md` - WebSocket protocol spec
- `docs/BACKEND_INTEGRATION.md` - Backend service guide
- `docs/PRD.md` - Product requirements

## Naming Conventions

**Files:**
- `snake_case.py` for Python modules (`groq_stt.py`, `tone_aggregator.py`, `braille_ueb.py`)
- `PascalCase.tsx` for React components (`LiveWorkspace.tsx`, `BrailleCell.tsx`)
- `camelCase.ts` for hooks and utilities (`useWebSocket.ts`, `api.ts`, `constants.ts`)
- `test_*.py` for Python test files (`test_augment.py`, `test_smoke.py`)
- `page.tsx` for Next.js routes (directory-based routing)

**Directories:**
- `snake_case` for Python directories (`routers/`, `services/`, `models/`)
- `kebab-case` for frontend directories (`senseai-frontend/`, `video-call-poc/`)
- Plural for collections (`routers/`, `services/`, `hooks/`, `components/`)

**Special Patterns:**
- `__init__.py` for Python package directories
- `conftest.py` for pytest fixtures (root + tests/)
- `page.tsx` for Next.js App Router pages

## Where to Add New Code

**New Backend Service (external API):**
- Implementation: `backend/app/services/{name}.py`
- Router: `backend/app/routers/{feature}.py`
- Schema: `backend/app/models/schemas.py`
- Register router in: `backend/app/main.py`

**New Frontend Page:**
- Page: `senseai-frontend/src/app/{route}/page.tsx`
- Components: `senseai-frontend/src/components/{Name}.tsx`
- Hooks: `senseai-frontend/src/hooks/use{Name}.ts`

**New ML Feature:**
- Logic: `ml/utils.py` or new module in `ml/`
- Tests: `ml/tests/test_{name}.py`
- WebSocket handler update: `ml/ws_server.py`

**New Accessibility Profile:**
- Frontend page: `senseai-frontend/src/app/live/{profile}/page.tsx`
- Profile config: `backend/app/routers/profile.py` (CHANNEL_CONFIG)
- Profile helper: `senseai-frontend/src/lib/profile.ts`

## Special Directories

**ml/venv/:**
- Purpose: Python 3.12 virtual environment
- Source: Created manually with Python 3.12
- Committed: No (gitignored)

**ml/MP_Data/:**
- Purpose: MediaPipe keypoint training data
- Source: Generated by `ml/collect_data.py` and `ml/augment.py`
- Committed: Partially (zip file `ml/MP_Data.zip`)

**ml/models/:**
- Purpose: Trained model artifacts
- Source: Generated by `ml/train_model.py`
- Committed: Yes (action_model.h5, actions.npy)

**vendor/:**
- Purpose: Third-party vendored code
- Committed: No (gitignored or untracked)

---

*Structure analysis: 2026-02-10*
*Update when directory structure changes*
