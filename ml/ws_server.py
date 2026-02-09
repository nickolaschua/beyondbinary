"""
FastAPI WebSocket server for real-time ASL sign detection.

Receives base64-encoded JPEG frames from the browser frontend,
runs MediaPipe Holistic + LSTM inference, and returns JSON predictions.

Endpoints:
    GET  /health               — Server status and model info
    WS   /ws/sign-detection    — WebSocket for frame-by-frame detection

Run:
    uvicorn ws_server:app --host 0.0.0.0 --port 8001 --reload
"""

import base64
import json
import logging
import time
from collections import deque

import cv2
import numpy as np
import mediapipe as mp
import tensorflow as tf
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from utils import (
    ACTIONS,
    SEQUENCE_LENGTH,
    MODEL_PATH,
    mediapipe_detection,
    extract_keypoints,
)

# --- Configuration ---
CONFIDENCE_THRESHOLD = 0.7
STABILITY_WINDOW = 8
HOST = "0.0.0.0"
PORT = 8001

# --- Logging ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ws_server")

# --- App ---
app = FastAPI(title="SenseAI Sign Detection", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global model (loaded once at startup) ---
model = None


@app.on_event("startup")
async def load_model():
    global model
    logger.info(f"Loading model from {MODEL_PATH}...")
    model = tf.keras.models.load_model(MODEL_PATH)
    logger.info(f"Model loaded. Actions: {list(ACTIONS)}")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "actions": list(ACTIONS),
        "sequence_length": SEQUENCE_LENGTH,
    }


def decode_frame(data: str) -> np.ndarray | None:
    """Decode a base64-encoded JPEG (with or without data URL prefix) to an OpenCV frame.

    Returns None if the input is empty, not valid base64, or not a valid image.
    """
    if not data or not data.strip():
        return None

    # Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
    if data.startswith("data:"):
        data = data.split(",", 1)[1]

    if not data:
        return None

    try:
        img_bytes = base64.b64decode(data)
    except Exception:
        return None

    if not img_bytes:
        return None

    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    return frame


@app.websocket("/ws/sign-detection")
async def sign_detection(websocket: WebSocket):
    await websocket.accept()
    client = websocket.client
    logger.info(f"Client connected: {client}")

    # Per-connection state
    mp_holistic = mp.solutions.holistic
    holistic = mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5)
    keypoint_buffer = deque(maxlen=SEQUENCE_LENGTH)
    prediction_history = deque(maxlen=STABILITY_WINDOW)
    current_sign = None
    frames_processed = 0

    try:
        while True:
            raw = await websocket.receive_text()

            # Parse message
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            if msg.get("type") != "frame":
                await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg.get('type')}"})
                continue

            frame_data = msg.get("frame", "")
            if not frame_data:
                continue

            # Decode base64 frame
            try:
                frame = decode_frame(frame_data)
            except Exception:
                await websocket.send_json({"type": "error", "message": "Failed to decode frame"})
                continue

            if frame is None:
                continue

            # MediaPipe detection
            _, results = mediapipe_detection(frame, holistic)

            # Check if hands detected
            hands_detected = (results.left_hand_landmarks is not None
                              or results.right_hand_landmarks is not None)

            # Extract keypoints
            keypoints = extract_keypoints(results)
            keypoint_buffer.append(keypoints)
            frames_processed += 1

            # Not enough frames yet — send buffering status
            if len(keypoint_buffer) < SEQUENCE_LENGTH:
                await websocket.send_json({
                    "type": "buffering",
                    "frames_collected": len(keypoint_buffer),
                    "frames_needed": SEQUENCE_LENGTH,
                    "hands_detected": hands_detected,
                })
                continue

            # Run prediction
            sequence = np.expand_dims(np.array(list(keypoint_buffer)), axis=0)
            predictions = model.predict(sequence, verbose=0)[0]

            predicted_idx = int(np.argmax(predictions))
            confidence = float(predictions[predicted_idx])
            predicted_sign = str(ACTIONS[predicted_idx])

            # Build all_predictions dict
            all_predictions = {str(ACTIONS[i]): round(float(predictions[i]), 4) for i in range(len(ACTIONS))}

            # Stability filter
            is_stable = False
            is_new_sign = False

            if confidence >= CONFIDENCE_THRESHOLD:
                prediction_history.append(predicted_sign)

                if (len(prediction_history) == STABILITY_WINDOW
                        and len(set(prediction_history)) == 1):
                    is_stable = True
                    stable_sign = prediction_history[0]
                    if stable_sign != current_sign:
                        is_new_sign = True
                        current_sign = stable_sign
                        logger.info(f"New sign detected: {stable_sign} ({confidence:.2f})")
            else:
                prediction_history.append(None)

            await websocket.send_json({
                "type": "sign_prediction",
                "sign": predicted_sign,
                "confidence": round(confidence, 4),
                "is_stable": is_stable,
                "is_new_sign": is_new_sign,
                "hands_detected": hands_detected,
                "all_predictions": all_predictions,
                "frames_processed": frames_processed,
            })

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {client}")
    except Exception as e:
        logger.error(f"Error with client {client}: {e}")
    finally:
        holistic.close()
        logger.info(f"MediaPipe closed for client: {client}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ws_server:app", host=HOST, port=PORT, reload=True)
