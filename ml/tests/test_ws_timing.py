"""
Tests for inference timing in ws_server.

Covers:
(a) sign_prediction response includes total_inference_ms field (numeric, >= 0)
(b) /health response includes avg_inference_ms field (numeric, >= 0)
"""

import json
import types
from collections import deque
from unittest.mock import patch, MagicMock

import numpy as np
import pytest
from fastapi.testclient import TestClient

import ws_server
from utils import SEQUENCE_LENGTH, ACTIONS


def _make_mock_results(hands=True):
    """Create mock MediaPipe results."""
    results = types.SimpleNamespace()
    results.pose_landmarks = None
    results.face_landmarks = None
    if hands:
        lm = types.SimpleNamespace()
        lm.landmark = [types.SimpleNamespace(x=0.5, y=0.5, z=0.0) for _ in range(21)]
        results.left_hand_landmarks = lm
        results.right_hand_landmarks = lm
    else:
        results.left_hand_landmarks = None
        results.right_hand_landmarks = None
    return results


def _make_fake_predictions():
    """Create a fake prediction array with one dominant class."""
    preds = np.zeros(len(ACTIONS))
    preds[0] = 0.95
    preds[1] = 0.05
    return preds


@pytest.fixture
def client():
    """TestClient with mock model."""
    mock_model = MagicMock()
    mock_model.predict.return_value = [_make_fake_predictions()]
    ws_server.model = mock_model
    # Reset inference_times deque if it exists
    if hasattr(ws_server, "inference_times"):
        ws_server.inference_times.clear()
    with TestClient(ws_server.app, raise_server_exceptions=False) as c:
        yield c
    ws_server.model = None


@pytest.fixture
def client_no_model():
    """TestClient with no model loaded."""
    ws_server.model = None
    if hasattr(ws_server, "inference_times"):
        ws_server.inference_times.clear()
    with TestClient(ws_server.app, raise_server_exceptions=False) as c:
        yield c
    ws_server.model = None


def _fill_buffer_and_get_prediction(ws, mock_model):
    """Send SEQUENCE_LENGTH frames to fill the buffer and get a prediction response."""
    mock_results = _make_mock_results(hands=True)
    keypoints = np.zeros(1662)

    with patch("ws_server.mediapipe_detection", return_value=(None, mock_results)), \
         patch("ws_server.extract_keypoints", return_value=keypoints):

        # Send SEQUENCE_LENGTH frames to fill the buffer
        for i in range(SEQUENCE_LENGTH):
            ws.send_text(json.dumps({"type": "frame", "frame": "dW5pdHRlc3Q="}))
            resp = json.loads(ws.receive_text())
            if i < SEQUENCE_LENGTH - 1:
                assert resp["type"] == "buffering"

        # Last response should be a prediction
        return resp


class TestInferenceTiming:
    """Tests for inference timing fields in responses."""

    def test_sign_prediction_includes_total_inference_ms(self, client):
        """sign_prediction response must include total_inference_ms (numeric, >= 0)."""
        # We need decode_frame to return a valid frame
        fake_frame = np.zeros((480, 640, 3), dtype=np.uint8)

        with patch("ws_server.decode_frame", return_value=fake_frame):
            with client.websocket_connect("/ws/sign-detection") as ws:
                resp = _fill_buffer_and_get_prediction(ws, ws_server.model)

                assert resp["type"] == "sign_prediction", f"Expected sign_prediction, got {resp}"
                assert "total_inference_ms" in resp, "Response missing total_inference_ms field"
                assert isinstance(resp["total_inference_ms"], (int, float)), \
                    f"total_inference_ms should be numeric, got {type(resp['total_inference_ms'])}"
                assert resp["total_inference_ms"] >= 0, \
                    f"total_inference_ms should be >= 0, got {resp['total_inference_ms']}"

    def test_health_includes_avg_inference_ms(self, client):
        """After processing frames, /health should include avg_inference_ms field."""
        fake_frame = np.zeros((480, 640, 3), dtype=np.uint8)

        # First, run some inference to populate timing data
        with patch("ws_server.decode_frame", return_value=fake_frame):
            with client.websocket_connect("/ws/sign-detection") as ws:
                _fill_buffer_and_get_prediction(ws, ws_server.model)

        # Now check /health
        response = client.get("/health")
        data = response.json()
        assert "avg_inference_ms" in data, "Health response missing avg_inference_ms field"
        assert isinstance(data["avg_inference_ms"], (int, float)), \
            f"avg_inference_ms should be numeric, got {type(data['avg_inference_ms'])}"
        assert data["avg_inference_ms"] >= 0, \
            f"avg_inference_ms should be >= 0, got {data['avg_inference_ms']}"

    def test_health_avg_inference_ms_zero_when_no_inferences(self, client_no_model):
        """Before any inference, /health should return avg_inference_ms of 0."""
        response = client_no_model.get("/health")
        data = response.json()
        assert "avg_inference_ms" in data, "Health response missing avg_inference_ms field"
        assert data["avg_inference_ms"] == 0
