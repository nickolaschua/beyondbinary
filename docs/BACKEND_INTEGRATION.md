# Backend Integration Guide — SenseAI ML Server

The ML server is a standalone FastAPI process. Your backend talks to it over HTTP/WebSocket — no ML code needed on your side.

## Quick Start

```bash
cd ml
venv/Scripts/python.exe -m uvicorn ws_server:app --host 0.0.0.0 --port 8001
```

Verify it's running:
```bash
curl http://localhost:8001/health
```

## Endpoints

### `GET /health`

Server status and model info.

**Response:**
```json
{
  "status": "ok",
  "model_loaded": true,
  "actions": ["Hello", "Thank_You", "Help", "Yes", "No", "Please", "Sorry", "I_Love_You", "Stop", "More"],
  "sequence_length": 30,
  "avg_inference_ms": 42.3
}
```

### `WS /ws/sign-detection`

Main detection endpoint. Accepts base64-encoded JPEG frames, returns sign predictions.

**Optional auth:** If `SENSEAI_API_KEY` is set, pass it as a query param:
```
ws://localhost:8001/ws/sign-detection?api_key=your_key
```

## WebSocket Protocol

### Sending Frames

Send one message per camera frame:

```json
{
  "type": "frame",
  "frame": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

- The `data:image/jpeg;base64,` prefix is optional — raw base64 also works
- Target ~10-15 fps for good detection without overwhelming the server
- Max payload: 5 MB per frame

### Receiving Messages

The server sends 3 message types:

#### 1. `buffering`

Sent for the first 30 frames while the keypoint buffer fills up. No predictions yet.

```json
{
  "type": "buffering",
  "frames_collected": 15,
  "frames_needed": 30,
  "hands_detected": true
}
```

#### 2. `sign_prediction`

Sent every frame after the buffer is full.

```json
{
  "type": "sign_prediction",
  "sign": "Hello",
  "confidence": 0.9234,
  "is_stable": true,
  "is_new_sign": true,
  "hands_detected": true,
  "all_predictions": {
    "Hello": 0.9234,
    "Thank_You": 0.0312,
    "Help": 0.0189,
    "Yes": 0.0087,
    "No": 0.0054,
    "Please": 0.0041,
    "Sorry": 0.0032,
    "I_Love_You": 0.0023,
    "Stop": 0.0016,
    "More": 0.0012
  },
  "frames_processed": 150,
  "total_inference_ms": 45.2,
  "sentence_in_progress": "Hello Help"
}
```

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `sign` | string | Top predicted sign |
| `confidence` | float | Confidence score (0-1) |
| `is_stable` | bool | True if the same sign was predicted N consecutive times above threshold |
| `is_new_sign` | bool | True if this is the first time this stable sign appears (use this to trigger UI updates) |
| `hands_detected` | bool | Whether MediaPipe detected hands in this frame |
| `all_predictions` | object | Confidence scores for all 10 signs |
| `sentence_in_progress` | string | Current accumulated sentence being built from stable signs |
| `total_inference_ms` | float | End-to-end processing time for this frame |

#### 3. `sentence_complete`

Sent when a 2-second pause is detected after at least one sign.

```json
{
  "type": "sentence_complete",
  "sentence": "Hello Help Please"
}
```

#### `error`

Sent on invalid input.

```json
{
  "type": "error",
  "message": "Rate limit exceeded: max 60 frames per 10 seconds"
}
```

## Frontend Integration Patterns

### Pattern A: Direct connection

Frontend connects directly to the ML server WebSocket. Simplest approach.

```
Browser (webcam) ──WebSocket──> ML Server (:8001)
```

### Pattern B: Backend proxy

Backend proxies the WebSocket. Useful if you need auth, logging, or want to combine ML results with other data.

```
Browser ──WebSocket──> Your Backend ──WebSocket──> ML Server (:8001)
```

### Recommended UI approach

- Show `sentence_in_progress` in a live text area (updates every frame)
- On `sentence_complete`, move the sentence to a history/transcript area
- Use `is_new_sign` to trigger visual feedback (flash the detected sign)
- Show `hands_detected` as a status indicator so users know to keep hands visible
- Show `buffering` progress on initial connection

## Swapping the Model

The model file lives at **`ml/models/action_model.h5`**. To swap:

1. Drop the new `.h5` file into `ml/models/` (overwrite the old one)
2. Restart the server

No code changes needed. The model must accept input shape `(batch, 30, 1662)` and output `(batch, 10)` with softmax over the 10 sign classes.

## Configuration

All config is via environment variables. Defaults work out of the box.

| Variable | Default | Description |
|---|---|---|
| `SENSEAI_HOST` | `0.0.0.0` | Bind address |
| `SENSEAI_PORT` | `8001` | Server port |
| `SENSEAI_CONFIDENCE_THRESHOLD` | `0.7` | Minimum confidence to accept a prediction |
| `SENSEAI_STABILITY_WINDOW` | `8` | Consecutive identical predictions required for stability |
| `SENSEAI_SENTENCE_TIMEOUT` | `2.0` | Seconds of silence before sentence is considered complete |
| `SENSEAI_API_KEY` | *(none)* | If set, clients must pass `?api_key=` on WebSocket connect |
| `SENSEAI_CORS_ORIGINS` | `*` | Comma-separated allowed CORS origins |

Example with custom config:
```bash
SENSEAI_PORT=9000 SENSEAI_API_KEY=secret123 python -m uvicorn ws_server:app --host 0.0.0.0 --port 9000
```

## Rate Limits

- Max 60 frames per 10-second window per WebSocket connection
- Max 5 MB per frame payload
- Exceeding limits returns an `error` message (connection stays open)

## Connection Lifecycle

1. Client opens WebSocket to `/ws/sign-detection`
2. Server creates per-connection MediaPipe instance + keypoint buffer
3. Client sends frames, server responds with buffering → predictions
4. On disconnect, server cleans up MediaPipe resources

Each connection is fully isolated — multiple clients can connect simultaneously with independent state.
