# Architecture

**Analysis Date:** 2026-02-10

## Pattern Overview

**Overall:** Monolithic ML Pipeline + Autonomous AI Agent Orchestration (Hybrid)

**Key Characteristics:**
- Single-purpose ML pipeline for ASL sign detection (data collection -> training -> inference)
- On-device inference (no cloud ML services)
- Real-time WebSocket server for browser-based sign detection
- Autonomous Ralph loop for unattended development task completion
- All ML modules share constants/utilities via single hub (`ml/utils.py`)

## Layers

**Data Acquisition Layer:**
- Purpose: Capture webcam video, extract pose/hand/face landmarks, persist as structured data
- Contains: Data collection scripts, verification tools
- Key files: `ml/collect_data.py`, `ml/verify_data.py`
- Depends on: Shared utilities layer, MediaPipe, OpenCV, NumPy
- Used by: Training layer (consumes saved `.npy` files)

**Shared Utilities Layer:**
- Purpose: Central hub of constants, functions, and abstractions used by all ML scripts
- Contains: Constants (ACTIONS, SEQUENCE_LENGTH), detection functions, keypoint extraction, StabilityFilter
- Key files: `ml/utils.py`
- Depends on: MediaPipe, TensorFlow, NumPy, OpenCV
- Used by: All other ML layers

**Training Layer:**
- Purpose: Load keypoint sequences, build LSTM classifier, train, evaluate, save model
- Contains: Data loading, model architecture definition, training loop, evaluation metrics
- Key files: `ml/train_model.py`
- Depends on: Shared utilities layer, TensorFlow, scikit-learn, matplotlib
- Used by: Inference layer (consumes trained model)

**Inference Layer (WebSocket Server):**
- Purpose: Real-time frame-by-frame ASL sign prediction with <200ms latency target
- Contains: FastAPI app, WebSocket endpoint, frame decoding, per-connection state
- Key files: `ml/ws_server.py`
- Depends on: Shared utilities layer, FastAPI, TensorFlow, MediaPipe, OpenCV
- Used by: Browser clients via WebSocket

**Testing Layer:**
- Purpose: Automated test suite enabling CI/CD without GPU/webcam/MediaPipe runtime
- Contains: pytest fixtures, mock MediaPipe results, unit and integration tests
- Key files: `ml/conftest.py`, `ml/tests/conftest.py`, `ml/tests/test_*.py` (21 files)
- Depends on: Shared utilities layer (after mocking), pytest
- Used by: Ralph verification gate, manual development

**Orchestration Layer (Ralph Loop):**
- Purpose: Autonomous AI agent loop that iteratively completes development tasks
- Contains: Bash loop script, Claude prompt templates, Docker configuration
- Key files: `scripts/ralph/ralph.sh`, `scripts/ralph/CLAUDE*.md`, `Dockerfile`, `docker-compose.yml`
- Depends on: Claude Code CLI, pytest (verification gate)
- Used by: Developers via `make ralph-once` or `make ralph-afk`

## Data Flow

**ML Pipeline (Collect -> Train -> Serve):**

1. Data Collection: Webcam -> MediaPipe Holistic -> extract_keypoints() -> 1662-dim vector -> `MP_Data/{action}/{seq}/{frame}.npy`
2. Data Verification: Read `.npy` files -> validate shape (1662,) -> check hand detection rates
3. Training: Load `.npy` sequences -> reshape to (N, 30, 1662) -> train 3-layer LSTM -> save `action_model.h5`
4. Inference: base64 JPEG frame -> decode -> MediaPipe -> extract_keypoints -> 30-frame buffer -> LSTM predict -> stability filter -> JSON response

**WebSocket Frame Processing Pipeline:**

1. Receive JSON `{"type": "frame", "frame": "base64..."}`
2. Rate limit check (max 60 frames / 10 seconds per client)
3. `decode_frame()`: base64 -> JPEG decode -> OpenCV BGR frame
4. `mediapipe_detection()`: BGR -> RGB -> MediaPipe Holistic -> landmarks
5. `extract_keypoints()`: landmarks -> 1662-dim flat array
6. Buffer in 30-frame sliding window (`deque(maxlen=30)`)
7. When buffer full: `model.predict()` on (1, 30, 1662) sequence
8. `StabilityFilter.update()`: check N consecutive identical predictions above threshold
9. Return JSON with sign, confidence, stability status

**State Management:**
- File-based: Training data in `ml/MP_Data/`, model in `ml/models/`
- Per-connection: Each WebSocket client has own MediaPipe instance, keypoint buffer, stability filter
- Global: Single TensorFlow model loaded at server startup (shared across connections)

## Key Abstractions

**StabilityFilter (`ml/utils.py`):**
- Purpose: Temporal smoothing to prevent flickering predictions
- Pattern: Sliding window state machine (deque-based)
- Requires N consecutive identical predictions above confidence threshold
- Returns: `{is_stable, is_new_sign, sign}`

**extract_keypoints (`ml/utils.py`):**
- Purpose: Convert MediaPipe landmarks to fixed-size vector
- Pattern: Critical contract function (MUST return shape 1662)
- Order: [pose(132), face(1404), lh(63), rh(63)] - IMMUTABLE
- Runtime assertion enforced

**Lifespan Context Manager (`ml/ws_server.py`):**
- Purpose: Load TensorFlow model once at startup, not per-request
- Pattern: FastAPI lifespan context manager
- Graceful degradation: server starts even if model missing

## Entry Points

**Data Collection:**
- Location: `ml/collect_data.py`
- Triggers: `python ml/collect_data.py [--actions Hello,Yes] [--num_sequences 30]`
- Responsibilities: Webcam capture, landmark extraction, data persistence

**Data Verification:**
- Location: `ml/verify_data.py`
- Triggers: `python ml/verify_data.py [--data_path PATH] [--min_hands 15]`
- Responsibilities: Validate data quality before training

**Model Training:**
- Location: `ml/train_model.py`
- Triggers: `python ml/train_model.py [--epochs 200] [--batch_size 16] [--learning_rate 0.001]`
- Responsibilities: Load data, build LSTM, train, evaluate, save model

**WebSocket Server:**
- Location: `ml/ws_server.py`
- Triggers: `python ml/ws_server.py` or `uvicorn ws_server:app --port 8001`
- Responsibilities: Real-time sign detection via WebSocket, health endpoint

**Ralph Loop:**
- Location: `scripts/ralph/ralph.sh`
- Triggers: `make ralph-once` (1 iteration) or `make ralph-afk` (20 iterations)
- Responsibilities: Read TODO.md, spawn Claude, verify tests, commit changes

**Tests:**
- Location: `ml/tests/`
- Triggers: `cd ml && pytest tests/ -x -q --tb=short`
- Responsibilities: Automated validation of all ML pipeline components

## Error Handling

**Strategy:** Log errors with context, graceful degradation where possible, fail fast on critical contracts

**Patterns:**
- Model loading: Logs error, server starts without model (health endpoint reports `model_loaded: false`)
- Frame decoding: Returns None for invalid input, WebSocket sends error JSON to client
- Keypoint extraction: Runtime assertion on shape (1662,) - fails hard if violated
- Training: Logs warnings for missing sequences, continues with available data
- Ralph loop: Verification gate (pytest must pass) before committing changes

## Cross-Cutting Concerns

**Logging:**
- Python `logging` module throughout ML code
- Format: `%(asctime)s [%(levelname)s] %(message)s`
- Levels: INFO for normal operations, WARNING for threshold violations, ERROR for failures

**Validation:**
- Runtime assertion on `extract_keypoints()` output shape
- CLI argument validation (action names, numeric ranges)
- Frame size limit (5MB) in `decode_frame()`
- Rate limiting (60 frames / 10s per client)

**Configuration:**
- Environment variable overrides with sensible defaults in `ml/utils.py`
- CLI arguments for all scripts with argparse
- No config files beyond `.env`

---

*Architecture analysis: 2026-02-10*
*Update when major patterns change*
