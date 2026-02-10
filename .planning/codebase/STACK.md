# Technology Stack

**Analysis Date:** 2026-02-10

## Languages

**Primary:**
- Python 3.12 - All ML pipeline code (`ml/`)
- TypeScript ~5.9.3 - Frontend flowchart visualization (`vendor/ralph-loop/flowchart/`)

**Secondary:**
- Bash/Shell - Automation & orchestration (`scripts/ralph/`, `Makefile`)
- JavaScript/JSX (ES2022) - React components

## Runtime

**Environment:**
- Python 3.12 (NOT compatible with 3.13 due to MediaPipe constraint)
- Node.js 20+ (via `node:20-slim` Docker image)
- Docker for containerized Ralph loop execution
- Uvicorn 0.40.0 ASGI server for FastAPI

**Package Manager:**
- pip - Python packages (`ml/requirements.txt`, all versions pinned)
- npm - Node.js packages (`vendor/ralph-loop/flowchart/package-lock.json`)

## Frameworks

**Core:**
- FastAPI 0.128.6 - REST API & WebSocket server (`ml/ws_server.py`)
- React 19.2.0 - UI framework for flowchart visualization (`vendor/ralph-loop/flowchart/`)
- TensorFlow 2.16.2 - Deep learning / LSTM inference (`ml/train_model.py`, `ml/ws_server.py`)
- MediaPipe 0.10.21 - Computer vision pose/hand/face detection (`ml/utils.py`)

**Testing:**
- pytest - Python test suite (`ml/tests/`)

**Build/Dev:**
- Vite 7.2.4 - Frontend bundler (`vendor/ralph-loop/flowchart/vite.config.ts`)
- TypeScript ~5.9.3 - Type checking (`vendor/ralph-loop/flowchart/tsconfig.app.json`)
- ESLint 9.39.1 - Linting (`vendor/ralph-loop/flowchart/eslint.config.js`)
- Make - Build automation (`Makefile`)

## Key Dependencies

**Critical (ML Pipeline):**
- mediapipe 0.10.21 - Pose/face/hand landmark detection (PINNED: last version with `mp.solutions.holistic`) (`ml/requirements.txt`)
- tensorflow 2.16.2 - LSTM model training & inference (PINNED: numpy<2 compatible) (`ml/requirements.txt`)
- numpy 1.26.4 - Numerical computing (PINNED: constrained by MediaPipe) (`ml/requirements.txt`)
- opencv-python 4.11.0.86 - Video capture & image I/O (`ml/requirements.txt`)
- scikit-learn 1.6.1 - Train/test split, metrics (`ml/train_model.py`)

**Critical (Frontend):**
- @xyflow/react 12.10.0 - Node/graph flowchart visualization (`vendor/ralph-loop/flowchart/package.json`)

**Infrastructure:**
- uvicorn 0.40.0 - ASGI server (`ml/requirements.txt`)
- websockets 16.0 - WebSocket client for testing (`ml/requirements.txt`)
- python-multipart 0.0.22 - Form data parsing (`ml/requirements.txt`)
- matplotlib 3.10.8 - Training visualization (`ml/requirements.txt`)

## Configuration

**Environment:**
- `.env` file (gitignored) for `ANTHROPIC_API_KEY`
- Runtime config via environment variables with defaults in `ml/utils.py`:
  - `SENSEAI_HOST` (default: "0.0.0.0")
  - `SENSEAI_PORT` (default: 8001)
  - `SENSEAI_CONFIDENCE_THRESHOLD` (default: 0.7)
  - `SENSEAI_STABILITY_WINDOW` (default: 8)

**Build:**
- `vendor/ralph-loop/flowchart/vite.config.ts` - Vite config (base path: `/ralph/`)
- `vendor/ralph-loop/flowchart/tsconfig.app.json` - TypeScript strict mode
- `vendor/ralph-loop/flowchart/eslint.config.js` - ESLint with React/TS plugins
- `Makefile` - Docker build targets (`ralph-once`, `ralph-afk`)

## Platform Requirements

**Development:**
- Windows/macOS/Linux with Python 3.12
- Webcam required for data collection (`ml/collect_data.py`)
- No GPU required (CPU inference)

**Production:**
- Docker container (`Dockerfile` base: `node:20-slim`)
- Non-root user `ralph` for container execution
- Uvicorn for WebSocket server: `uvicorn ws_server:app --host 0.0.0.0 --port 8001`

## Critical Version Constraints

**Dependency chain (DO NOT CHANGE independently):**
```
MediaPipe 0.10.21 (last version with mp.solutions.holistic legacy API)
  -> requires numpy<2
    -> TensorFlow 2.16.2 (numpy<2 compatible)
      -> NumPy 1.26.4
```

Breaking any link in this chain will cause import errors or runtime failures.

---

*Stack analysis: 2026-02-10*
*Update after major dependency changes*
