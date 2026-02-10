"""Sign Detection WebSocket — proxied from ML lead's code.

This is Option B: hosting the ML lead's sign detection endpoint
within the main backend server. If using Option A (separate server),
this file is not needed.

Requires: mediapipe, tensorflow, opencv-python installed on the server.
Requires: models/action_model.h5 present in the backend directory.

For now: mock placeholder for frontend to build against.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws/sign-detection")
async def sign_detection_placeholder(websocket: WebSocket):
    """
    Placeholder for sign detection WebSocket.

    Expected message format FROM frontend:
        { "type": "frame", "frame": "<base64 jpeg>" }

    Expected response TO frontend:
        { "type": "sign_prediction", "sign": "Hello", "confidence": 0.95,
          "is_stable": true, "is_new_sign": true, "hands_detected": true }
        { "type": "buffering", "frames_collected": 15, "frames_needed": 30,
          "hands_detected": true }

    To enable: replace this placeholder with the ML lead's actual inference code.
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({
                "type": "sign_prediction",
                "sign": "Hello",
                "confidence": 0.99,
                "is_stable": True,
                "is_new_sign": False,
                "hands_detected": True,
                "all_predictions": {"Hello": 0.99},
                "frames_processed": 0,
                "_mock": True,
            })
    except WebSocketDisconnect:
        pass
