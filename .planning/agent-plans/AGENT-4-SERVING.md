# Agent 4: Serving (Phases 7-10)

## Working Directory
```
C:\Users\nicko\Desktop\beyondbinary\worktrees\agent-4-serving
```

## Branch
`agent/serving`

## Mission
Build the real-time inference script, the WebSocket server, and integration testing tools. You are the bridge between the trained ML model and the browser frontend. Your code is what the frontend team connects to during the demo.

## Dependencies
You depend on:
- Agent 1's `ml/utils.py` for shared functions
- Agent 3's model architecture (but you load the .h5 file, you don't build it)

### Interface Contract (from utils.py)
```python
ACTIONS = np.array(['Hello', 'Thank_You', 'Help', 'Yes', 'No', 'Please', 'Sorry', 'I_Love_You', 'Stop', 'More'])
SEQUENCE_LENGTH = 30
MODEL_PATH = 'models/action_model.h5'

def mediapipe_detection(image, model) -> tuple[np.ndarray, Any]: ...
def draw_landmarks(image, results) -> None: ...
def extract_keypoints(results) -> np.ndarray:  # shape (1662,)
```

### Model Contract (from Agent 3)
- Input: `(1, 30, 1662)` — batch of 1, 30 frames, 1662 features
- Output: `(1, 10)` — probabilities for 10 actions
- Loaded via: `tf.keras.models.load_model('models/action_model.h5')`

## What You Deliver

### 1. `ml/test_realtime.py` (Phase 7)

Standalone real-time sign detection from local webcam. This verifies the model works before going to WebSocket.

**Behavior:**
- Load model from `models/action_model.h5`
- Open webcam (640x480)
- Sliding window buffer: `deque(maxlen=30)` of keypoint frames
- Each frame: MediaPipe → extract_keypoints → append to buffer
- When buffer is full (30 frames): run `model.predict()` on the sequence
- **Confidence threshold**: 0.7 — only show predictions above this
- **Stability filter**: track last 8 predictions in a `deque(maxlen=8)`. Only accept when ALL 8 are the same class AND confidence > threshold. This prevents flickering.
- **Deduplication**: don't add same sign consecutively to sentence
- **Display**:
  - Top bar (orange): detected sentence (last 5 signs joined with ' | ')
  - Probability bars: one per action, color-coded, showing raw probabilities
  - Landmarks drawn on frame
- Press 'q' to quit
- Print detected signs to console: `Detected: {sign} ({confidence:.2f})`

**Import from utils.py:**
```python
from utils import (ACTIONS, SEQUENCE_LENGTH, MODEL_PATH,
                   mediapipe_detection, draw_landmarks, extract_keypoints)
```

### 2. `ml/ws_server.py` (Phase 8)

FastAPI WebSocket server that the browser frontend connects to.

**Endpoints:**

`GET /health`
```json
{
    "status": "ok",
    "model_loaded": true,
    "actions": ["Hello", "Thank_You", ...],
    "sequence_length": 30
}
```

`WS /ws/sign-detection`
- Accepts WebSocket connection
- Per-connection state: sliding window buffer, prediction history, current sign
- Creates a NEW MediaPipe Holistic instance per connection (thread safety)
- Receives messages: `{"type": "frame", "frame": "<base64 jpeg or data URL>"}`
- Decodes base64 → OpenCV frame (handle `data:image/jpeg;base64,` prefix)
- Runs MediaPipe → extract_keypoints → append to buffer
- When buffer full: predict → stability check → respond

**Response while buffering:**
```json
{
    "type": "buffering",
    "frames_collected": 15,
    "frames_needed": 30,
    "hands_detected": true
}
```

**Response with prediction:**
```json
{
    "type": "sign_prediction",
    "sign": "Hello",
    "confidence": 0.95,
    "is_stable": true,
    "is_new_sign": true,
    "hands_detected": true,
    "all_predictions": {
        "Hello": 0.95,
        "Thank_You": 0.02,
        ...
    },
    "frames_processed": 45
}
```

**Server config:**
- CORS: allow all origins (hackathon)
- Load model at startup (global, NOT per-connection)
- MediaPipe Holistic: per-connection (NOT global — not thread-safe)
- Close MediaPipe instance in `finally` block on disconnect
- Log connections/disconnections to console

**Run command:** `uvicorn ws_server:app --host 0.0.0.0 --port 8001 --reload`

### 3. `ml/test_ws_client.py` (Phase 9)

A simple Python WebSocket test client for integration testing WITHOUT a browser.

**Behavior:**
- Connect to `ws://localhost:8001/ws/sign-detection`
- Open local webcam
- Capture frames at ~10 FPS (100ms interval)
- Encode as base64 JPEG (quality 70%)
- Send as `{"type": "frame", "frame": "<base64>"}`
- Print received predictions to console
- Measure and display latency (time between send and receive)
- Press 'q' to quit

This lets you test the full pipeline without needing the browser frontend.

### 4. `ml/test_ws_health.py` (Phase 9)

A tiny script that just hits the health endpoint:
```python
import requests
r = requests.get('http://localhost:8001/health')
print(r.json())
```

## Technical Constraints

- **Stability filter**: 8 consecutive same predictions (adapted from SomyanshAvasthi's 10-frame approach, but using set comparison instead of np.unique to avoid the edge case bug)
- **Confidence threshold**: 0.7 (between nicknochnack's 0.8 and SomyanshAvasthi's 0.5)
- **Frame decode**: Handle both raw base64 AND data URL prefix (`data:image/jpeg;base64,`)
- **WebSocket backpressure**: If inference is slower than frame arrival, skip frames (don't queue infinitely)
- **Port**: 8001 (main backend is on 8000)
- **CORS**: Allow all origins for hackathon (`allow_origins=["*"]`)
- **Model loading**: Load once at startup, share across connections. Do NOT load per-connection.
- **MediaPipe**: Create per-connection, close in finally block. It is NOT thread-safe.

## Verification

Before committing, verify:
- [ ] `test_realtime.py` opens webcam, shows landmarks, shows probability bars
- [ ] Stability filter prevents flickering (signs don't flash rapidly)
- [ ] `ws_server.py` starts without errors: `uvicorn ws_server:app --port 8001`
- [ ] `test_ws_health.py` returns correct JSON from health endpoint
- [ ] `test_ws_client.py` connects, sends frames, receives predictions
- [ ] Latency is reported by test client
- [ ] Server handles client disconnect gracefully (no crashes)

## Git

```bash
cd C:\Users\nicko\Desktop\beyondbinary\worktrees\agent-4-serving
# When done:
git add ml/test_realtime.py ml/ws_server.py ml/test_ws_client.py ml/test_ws_health.py
git commit -m "feat(07-10): serving - realtime inference, WebSocket server, integration tests

- test_realtime.py: standalone webcam sign detection with stability filter
- ws_server.py: FastAPI WebSocket at /ws/sign-detection on port 8001
- test_ws_client.py: Python WebSocket test client with latency measurement
- test_ws_health.py: health endpoint verification

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

## IMPORTANT
- Do NOT create utils.py (Agent 1)
- Do NOT create collect_data.py or verify_data.py (Agent 2)
- Do NOT create training notebook or train_model.py (Agent 3)
- You CAN create a mock/dummy model for testing if action_model.h5 doesn't exist yet — but the real model comes from Agent 3
- Your ONLY job is inference + serving + testing
