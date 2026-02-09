# Architecture

**Analysis Date:** 2026-02-10

## Pattern Overview

**Overall:** ML Pipeline with WebSocket Serving Layer

**Key Characteristics:**
- Sequential processing pipeline (collect -> verify -> train -> serve)
- Real-time streaming inference via WebSocket
- Shared utility module enforcing data contracts (`ml/utils.py`)
- Per-connection state management in WebSocket server
- Stateful sliding window buffers for temporal prediction

## Layers

**Utility & Shared Layer:**
- Purpose: Enforce consistency across all pipeline scripts
- Contains: Constants (ACTIONS, SEQUENCE_LENGTH), MediaPipe detection wrapper, keypoint extraction
- Location: `ml/utils.py`
- Depends on: mediapipe, opencv, numpy
- Used by: All other layers
- Critical contract: `extract_keypoints()` returns shape (1662,) with order [pose(132), face(1404), lh(63), rh(63)]

**Data Collection Layer:**
- Purpose: Record ASL sign language data from webcam
- Contains: Webcam capture, MediaPipe processing, .npy serialization
- Location: `ml/collect_data.py`
- Depends on: Utility layer, OpenCV, MediaPipe
- Used by: Training layer (produces MP_Data/)

**Data Verification Layer:**
- Purpose: Quality gate before model training
- Contains: Sequence count validation, keypoint shape checks, hand detection rate analysis
- Location: `ml/verify_data.py`
- Depends on: numpy (standalone by design)
- Used by: Human operator (go/no-go for training)

**Model Training Layer:**
- Purpose: Train 3-layer LSTM classifier on keypoint sequences
- Contains: Model architecture, training loop, evaluation, visualization
- Location: `ml/train_model.py`, `ml/training_notebook.ipynb`
- Depends on: Utility layer, TensorFlow/Keras, scikit-learn, matplotlib
- Used by: Inference and serving layers (produces action_model.h5)

**Real-Time Inference Layer:**
- Purpose: Standalone webcam sign detection for verification
- Contains: Sliding window buffer, confidence thresholding, stability filtering, visualization
- Location: `ml/test_realtime.py`
- Depends on: Utility layer, TensorFlow, OpenCV
- Used by: Human operator (verify model before serving)

**WebSocket Serving Layer:**
- Purpose: Serve sign predictions via WebSocket to frontend
- Contains: FastAPI server, per-connection state, frame decoding, LSTM inference
- Location: `ml/ws_server.py`
- Depends on: Utility layer, FastAPI, TensorFlow, MediaPipe, OpenCV
- Used by: Frontend (Next.js browser client)

**Testing/Verification Layer:**
- Purpose: Validate environment, server health, end-to-end integration
- Contains: Import checks, webcam tests, health checks, WebSocket client tests
- Location: `ml/test_setup.py`, `ml/test_ws_client.py`, `ml/test_ws_health.py`
- Depends on: Various (per test script)
- Used by: Human operator and CI/CD (future)

## Data Flow

**Data Collection Flow:**

1. Webcam captures BGR frame (OpenCV VideoCapture)
2. MediaPipe Holistic detects pose, face, hands (`ml/utils.py` mediapipe_detection)
3. Keypoints extracted and flattened to (1662,) array (`ml/utils.py` extract_keypoints)
4. Saved as .npy file to `MP_Data/{action}/{sequence}/{frame}.npy`
5. Repeated for 10 actions x 30 sequences x 30 frames = 9,000 files

**Training Flow:**

1. Load all .npy sequences from MP_Data/ (`ml/train_model.py` load_data)
2. Create X: (N, 30, 1662) and y: (N, 10) one-hot encoded
3. Stratified train/test split (90/10) (`ml/train_model.py`)
4. Build 3-layer LSTM: 64->128->64 units with BatchNorm+Dropout
5. Train with EarlyStopping (patience=30) and ModelCheckpoint
6. Evaluate on held-out test set, generate confusion matrix
7. Save model to `models/action_model.h5`

**WebSocket Inference Flow:**

1. Frontend sends base64 JPEG frame via WebSocket
2. Server decodes frame (`ml/ws_server.py` decode_frame)
3. MediaPipe Holistic detection on frame
4. Keypoints extracted to (1662,) array
5. Appended to 30-frame sliding window buffer (deque)
6. If buffer not full: return buffering status
7. If buffer full: reshape to (1, 30, 1662), run LSTM prediction
8. Apply confidence threshold (0.7) and stability filter (8-frame consensus)
9. Return JSON prediction with sign, confidence, stability flags

**State Management:**
- File-based: Training data in MP_Data/, model in models/
- Per-connection: WebSocket server maintains per-client buffers, prediction history, MediaPipe instance
- No database, no persistent in-memory state across connections

## Key Abstractions

**Shared Utility Module (`ml/utils.py`):**
- Purpose: Single source of truth for constants and detection functions
- Pattern: Module-level constants + pure functions
- Critical: Changing keypoint order breaks all downstream scripts

**Sliding Window Buffer:**
- Purpose: Temporal feature extraction (30 consecutive frames)
- Implementation: `collections.deque(maxlen=SEQUENCE_LENGTH)`
- Used in: `ml/test_realtime.py`, `ml/ws_server.py`
- Pattern: FIFO auto-discard, O(1) append

**Stability Filter:**
- Purpose: Reduce false positives by requiring N consecutive identical predictions
- Implementation: `deque(maxlen=STABILITY_WINDOW)` with set-equality check
- Used in: `ml/test_realtime.py`, `ml/ws_server.py`
- Config: CONFIDENCE_THRESHOLD=0.7, STABILITY_WINDOW=8

**Per-Connection State:**
- Purpose: Isolate WebSocket clients from each other
- Implementation: Function-scoped variables in WebSocket handler
- Includes: MediaPipe Holistic instance, keypoint buffer, prediction history, current_sign
- Lifecycle: Created on connect, destroyed on disconnect

## Entry Points

**Data Collection:**
- Location: `ml/collect_data.py`
- Triggers: `python ml/collect_data.py`
- Responsibilities: Record 10 ASL signs to MP_Data/

**Model Training (Local):**
- Location: `ml/train_model.py`
- Triggers: `python ml/train_model.py [--epochs 200] [--batch_size 16]`
- Responsibilities: Train LSTM, save model and diagnostics

**Model Training (Colab):**
- Location: `ml/training_notebook.ipynb`
- Triggers: Upload to Google Colab, run cells
- Responsibilities: Same as local but on T4 GPU

**WebSocket Server:**
- Location: `ml/ws_server.py`
- Triggers: `uvicorn ml.ws_server:app --host 0.0.0.0 --port 8001`
- Responsibilities: Serve sign predictions via WebSocket on port 8001

**Environment Verification:**
- Location: `ml/test_setup.py`
- Triggers: `python ml/test_setup.py`
- Responsibilities: Verify imports, webcam, MediaPipe, utils contract

## Error Handling

**Strategy:** Try/except at handler boundaries, log and continue or exit with status code

**Patterns:**
- WebSocket handler: catch `WebSocketDisconnect`, log, cleanup MediaPipe instance (`ml/ws_server.py`)
- Frame decoding: catch Exception, send error JSON to client, continue loop (`ml/ws_server.py`)
- Data loading: catch per-file exceptions, log warning, skip invalid sequences (`ml/train_model.py`)
- Test scripts: catch failures, report PASS/FAIL, exit with code 0 or 1

## Cross-Cutting Concerns

**Logging:**
- Python `logging` module with INFO level
- Format: `%(asctime)s [%(levelname)s] %(message)s`
- Used in: `ml/ws_server.py`, `ml/train_model.py`
- Simple scripts use `print()`: `ml/collect_data.py`, `ml/verify_data.py`

**Validation:**
- Keypoint shape contract enforced by `ml/utils.py` (returns zeros for missing landmarks)
- Data quality verified by `ml/verify_data.py` before training
- No schema validation on WebSocket messages (JSON parsed, type checked)

**Authentication:**
- None (localhost development only)
- CORS configured to allow all origins (`ml/ws_server.py`)

---

*Architecture analysis: 2026-02-10*
*Update when major patterns change*
