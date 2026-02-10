# External Integrations

**Analysis Date:** 2026-02-10

## APIs & External Services

**Anthropic Claude API:**
- Purpose: Autonomous task implementation via Ralph loop
- Tool: `@anthropic-ai/claude-code` CLI (installed globally in Docker)
- Auth: API key in `ANTHROPIC_API_KEY` env var (`.env` file, gitignored)
- Usage: `scripts/ralph/ralph.sh` spawns `claude --dangerously-skip-permissions --print`
- Required for: Ralph autonomous loop only (not for ML inference)

**Payment Processing:** Not integrated
**Email/SMS:** Not integrated
**Analytics/Monitoring:** Not integrated

## Data Storage

**Databases:** Not integrated
- All data persisted as NumPy `.npy` files in `ml/MP_Data/`
- No SQL or NoSQL database

**File Storage:**
- Local filesystem only
- Training data: `ml/MP_Data/{action}/{sequence}/{frame}.npy`
- Model artifacts: `ml/models/action_model.h5`
- No cloud storage (S3, GCS, etc.)

**Caching:** Not integrated

## Authentication & Identity

**Auth Provider:** Not integrated
- No user authentication system
- Local-only execution model

**OAuth Integrations:** None

## Monitoring & Observability

**Error Tracking:** Not integrated (no Sentry, etc.)

**Analytics:** Not integrated

**Logs:**
- Python `logging` module to stdout (`ml/ws_server.py`)
- Format: `%(asctime)s [%(levelname)s] %(message)s`
- Ralph loop logs to `logs/ralph-YYYYMMDD.log`
- No external log aggregation service

## CI/CD & Deployment

**Hosting:**
- Local development via Python venv + Uvicorn
- Docker Compose for Ralph autonomous loop
- No cloud hosting configured

**CI Pipeline:**
- `vendor/ralph-loop/.github/workflows/deploy.yml` (in vendored repo only)
- No CI pipeline for main project

## Environment Configuration

**Development:**
- Required env vars: None for ML pipeline (all have defaults)
- Optional: `SENSEAI_HOST`, `SENSEAI_PORT`, `SENSEAI_CONFIDENCE_THRESHOLD`, `SENSEAI_STABILITY_WINDOW`
- Secrets location: `.env` file (gitignored)
- No mock/stub services needed (all on-device inference)

**Ralph Loop (Docker):**
- Required: `ANTHROPIC_API_KEY` in `.env`
- Optional: `RALPH_ITERATIONS` (default: 20)
- Docker Compose loads env from `.env` file

**Production:**
- No production deployment configured
- Server runs via: `uvicorn ws_server:app --host 0.0.0.0 --port 8001`

## Webhooks & Callbacks

**Incoming:** None
**Outgoing:** None

## On-Device Libraries (No External API Calls)

**MediaPipe** - Computer vision (on-device, no cloud)
- Pose/face/hand detection via `mp.solutions.holistic`
- Integration: `ml/utils.py` (mediapipe_detection, extract_keypoints)

**TensorFlow** - Deep learning (on-device inference)
- LSTM model loaded at server startup
- Integration: `ml/ws_server.py` (lifespan context manager)

**OpenCV** - Image processing (on-device)
- Webcam capture and frame decoding
- Integration: `ml/collect_data.py`, `ml/ws_server.py`

---

*Integration audit: 2026-02-10*
*Update when adding/removing external services*
