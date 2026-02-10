# WebSocket Protocol Reference

Complete protocol documentation for the SenseAI sign detection WebSocket endpoint.

**Source of truth:** `ml/ws_server.py` and `ml/utils.py`

---

## Table of Contents

1. [Connection](#connection)
2. [Client to Server Messages](#client-to-server-messages)
3. [Server to Client Messages](#server-to-client-messages)
4. [Error Conditions](#error-conditions)
5. [Health Endpoint](#health-endpoint)
6. [Configuration](#configuration)
7. [Stability Filter](#stability-filter)
8. [Supported Signs](#supported-signs)

---

## Connection

### Endpoint

```
ws://{host}:{port}/ws/sign-detection
```

Default: `ws://0.0.0.0:8001/ws/sign-detection`

### Authentication

Authentication is **optional** and controlled by the `SENSEAI_API_KEY` environment variable.

- If `SENSEAI_API_KEY` is **not set** (default), authentication is disabled and all connections are accepted.
- If `SENSEAI_API_KEY` **is set**, clients must provide the key as a query parameter:

```
ws://{host}:{port}/ws/sign-detection?api_key=YOUR_KEY
```

**Rejection behavior:** If the API key is missing or incorrect, the server closes the WebSocket with:
- Close code: `4003`
- Reason: `Invalid or missing API key`

The connection is closed *before* the WebSocket handshake is accepted.

### Connection Lifecycle

1. Client opens WebSocket to `/ws/sign-detection` (with optional `?api_key=` query parameter).
2. Server validates API key if `SENSEAI_API_KEY` is set. Rejects with code `4003` on failure.
3. Server accepts the connection and initializes per-connection state:
   - A new MediaPipe Holistic instance (`min_detection_confidence=0.5`, `min_tracking_confidence=0.5`)
   - A keypoint buffer (capacity: `SEQUENCE_LENGTH` frames, default 30)
   - A stability filter
   - A frame rate limiter (max 60 frames per 10 seconds)
   - A frame counter
4. Client sends frame messages. Server responds with buffering status or predictions.
5. On disconnect, the server closes the MediaPipe instance and cleans up.

---

## Client to Server Messages

### Frame Message

The only supported client message type is `frame`.

```json
{
  "type": "frame",
  "frame": "<base64-encoded-jpeg>"
}
```

| Field   | Type   | Required | Description |
|---------|--------|----------|-------------|
| `type`  | string | Yes      | Must be `"frame"` |
| `frame` | string | Yes      | Base64-encoded JPEG image data |

**Frame requirements:**

- Must be a valid base64-encoded JPEG image.
- Maximum payload size: **5 MB** (5,000,000 characters of the raw `frame` string, measured before base64 decoding).
- An optional `data:image/jpeg;base64,` prefix is accepted and will be stripped automatically.
- An empty or whitespace-only `frame` value is silently ignored (no response sent).

---

## Server to Client Messages

All server messages are JSON objects with a `type` field.

### Buffering

Sent when the keypoint buffer does not yet contain enough frames for inference.

```json
{
  "type": "buffering",
  "frames_collected": 15,
  "frames_needed": 30,
  "hands_detected": true
}
```

| Field              | Type    | Description |
|--------------------|---------|-------------|
| `type`             | string  | Always `"buffering"` |
| `frames_collected` | integer | Number of keypoint frames currently in the buffer |
| `frames_needed`    | integer | Total frames required before inference runs (equals `SEQUENCE_LENGTH`, default 30) |
| `hands_detected`   | boolean | `true` if at least one hand (left or right) was detected in the current frame |

The server sends buffering messages for the first `SEQUENCE_LENGTH - 1` frames (frames 1 through 29 by default). Once the buffer reaches `SEQUENCE_LENGTH`, the server switches to sending `sign_prediction` messages.

### Sign Prediction

Sent after every frame once the buffer is full (i.e., starting from the 30th frame onward).

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
    "Thank_You": 0.0412,
    "Help": 0.0101,
    "Yes": 0.0053,
    "No": 0.0032,
    "Please": 0.0028,
    "Sorry": 0.0051,
    "I_Love_You": 0.0041,
    "Stop": 0.0029,
    "More": 0.0019
  },
  "frames_processed": 45,
  "total_inference_ms": 85.3
}
```

| Field                | Type    | Description |
|----------------------|---------|-------------|
| `type`               | string  | Always `"sign_prediction"` |
| `sign`               | string  | The predicted sign label (highest probability action) |
| `confidence`         | number  | Confidence score for the predicted sign, rounded to 4 decimal places (0.0 to 1.0) |
| `is_stable`          | boolean | `true` if the stability filter considers this prediction stable (see [Stability Filter](#stability-filter)) |
| `is_new_sign`        | boolean | `true` if this is the first time this sign became stable (fires once per stable detection) |
| `hands_detected`     | boolean | `true` if at least one hand was detected in the current frame |
| `all_predictions`    | object  | Map of every action label to its confidence score, each rounded to 4 decimal places |
| `frames_processed`   | integer | Total number of frames processed since this client connected |
| `total_inference_ms` | number  | Time in milliseconds for MediaPipe detection + model inference for this frame, rounded to 1 decimal place |

### Error

Sent when the server encounters a problem with a client message.

```json
{
  "type": "error",
  "message": "Invalid JSON"
}
```

| Field     | Type   | Description |
|-----------|--------|-------------|
| `type`    | string | Always `"error"` |
| `message` | string | Human-readable error description |

---

## Error Conditions

| Condition | Server Behavior | Error Message |
|-----------|----------------|---------------|
| Message is not valid JSON | Sends error response | `"Invalid JSON"` |
| Message `type` is not `"frame"` | Sends error response | `"Unknown message type: {type}"` (where `{type}` is the value of the `type` field, or `None` if missing) |
| Rate limit exceeded (60 frames in under 10 seconds) | Sends error response | `"Rate limit exceeded: max 60 frames per 10 seconds"` |
| Unexpected exception during frame decoding | Sends error response | `"Failed to decode frame"` |
| `frame` field is empty or missing | Silently ignored | No response sent |
| Frame payload exceeds 5 MB | Silently ignored | No response sent (logged server-side as a warning) |
| Base64 decoding fails | Silently ignored | No response sent |
| Decoded image is not valid (OpenCV cannot decode) | Silently ignored | No response sent |
| Data URL prefix present but no comma separator | Silently ignored | No response sent |

**Note on rate limiting:** The server tracks the timestamps of the last 60 frames per client. The rate limit triggers when all 60 slots are filled and the time span between the oldest and newest is less than 10 seconds. After a rate limit error, the frame is dropped (not processed), but the connection stays open.

---

## Health Endpoint

```
GET /health
```

Returns the current server status. This is a standard HTTP endpoint, not a WebSocket.

### Response

```json
{
  "status": "ok",
  "model_loaded": true,
  "actions": ["Hello", "Thank_You", "Help", "Yes", "No", "Please", "Sorry", "I_Love_You", "Stop", "More"],
  "sequence_length": 30,
  "avg_inference_ms": 85.3
}
```

| Field              | Type     | Description |
|--------------------|----------|-------------|
| `status`           | string   | Always `"ok"` |
| `model_loaded`     | boolean  | `true` if the LSTM model was successfully loaded at startup |
| `actions`          | string[] | List of sign labels the model can recognize |
| `sequence_length`  | integer  | Number of frames required per inference window |
| `avg_inference_ms` | number   | Rolling average inference time in milliseconds (over last 100 inferences), rounded to 1 decimal place. Returns `0` if no inferences have been performed yet. |

---

## Configuration

All configuration is via environment variables. Every variable has a safe default.

| Environment Variable | Type | Default | Description |
|---------------------|------|---------|-------------|
| `SENSEAI_HOST` | string | `0.0.0.0` | Host address the server binds to |
| `SENSEAI_PORT` | integer | `8001` | Port the server listens on |
| `SENSEAI_CORS_ORIGINS` | string | `*` | Comma-separated list of allowed CORS origins (e.g., `http://localhost:3000,https://app.example.com`). Each origin is trimmed of whitespace. |
| `SENSEAI_CONFIDENCE_THRESHOLD` | float | `0.7` | Minimum confidence score for a prediction to count toward the stability filter |
| `SENSEAI_STABILITY_WINDOW` | integer | `8` | Number of consecutive identical predictions (above threshold) required before a sign is considered stable |
| `SENSEAI_API_KEY` | string | *None* (auth disabled) | If set, clients must include `?api_key=VALUE` in the WebSocket URL to connect |

**Invalid values:** If `SENSEAI_PORT`, `SENSEAI_CONFIDENCE_THRESHOLD`, or `SENSEAI_STABILITY_WINDOW` contain non-numeric values, the server falls back to the default without raising an error.

---

## Stability Filter

The stability filter reduces noise by requiring multiple consecutive identical predictions before declaring a sign as "stable." This prevents flickering between signs during transitions.

### How It Works

1. Each prediction is checked against `SENSEAI_CONFIDENCE_THRESHOLD` (default: `0.7`).
2. If the confidence is **at or above** the threshold, the predicted sign is added to a history window.
3. If the confidence is **below** the threshold, `None` is added to the history window (effectively resetting the streak).
4. The history window has a fixed size of `SENSEAI_STABILITY_WINDOW` (default: `8`).
5. A prediction is considered **stable** (`is_stable = true`) when:
   - The history window is completely full (has `STABILITY_WINDOW` entries), AND
   - Every entry in the window is the same sign (no `None` values, no different signs)
6. A prediction is considered a **new sign** (`is_new_sign = true`) when:
   - The prediction is stable, AND
   - The stable sign is different from the previously detected stable sign

### Behavior

- `is_stable` is `true` on every frame where the stability condition holds. It remains `true` as long as the same sign continues to be predicted with sufficient confidence.
- `is_new_sign` is `true` only on the **first frame** where a new sign becomes stable. It then becomes `false` for subsequent frames of the same stable sign.
- If predictions fluctuate or drop below the confidence threshold, the stability window resets and `is_stable` returns to `false`.

### Frontend Integration Tip

- Use `is_new_sign` to trigger actions (e.g., appending a word to a transcript). This fires exactly once per stable sign detection.
- Use `is_stable` to show visual feedback (e.g., a "locked in" indicator).
- Use `confidence` and `all_predictions` for displaying real-time probability bars.

---

## Supported Signs

The model recognizes the following 10 ASL signs:

| Index | Label        |
|-------|-------------|
| 0     | Hello        |
| 1     | Thank_You    |
| 2     | Help         |
| 3     | Yes          |
| 4     | No           |
| 5     | Please       |
| 6     | Sorry        |
| 7     | I_Love_You   |
| 8     | Stop         |
| 9     | More         |

These labels are used as keys in `all_predictions` and as the value of the `sign` field.
