"""
Tests for per-client frame rate limiting in ws_server.

Covers:
(a) Normal rate → all frames accepted (no rate limit error)
(b) Burst over limit → rate limited error returned
"""

import json
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

import ws_server


@pytest.fixture
def client():
    """TestClient with model set to None (no model loading)."""
    ws_server.model = None
    with TestClient(ws_server.app, raise_server_exceptions=False) as c:
        yield c
    ws_server.model = None


def _send_frame_and_collect(ws):
    """Send a frame msg + a probe msg, return all responses from the pair.

    The probe (unknown type) guarantees at least one response, so we never hang.
    If rate limiting fires, the frame itself produces a response too.
    """
    ws.send_text(json.dumps({"type": "frame", "frame": "not_real_base64"}))
    ws.send_text(json.dumps({"type": "ping"}))

    # First response: either rate-limit error (from frame) or unknown-type error (from ping)
    resp1 = json.loads(ws.receive_text())
    responses = [resp1]

    # If we got a rate-limit error from the frame, the ping error is still queued
    if resp1.get("type") == "error" and "Rate limit" in resp1.get("message", ""):
        resp2 = json.loads(ws.receive_text())
        responses.append(resp2)

    return responses


class TestRateLimiting:
    """Tests for per-client WebSocket frame rate limiting."""

    def test_normal_rate_all_accepted(self, client):
        """Sending frames at normal rate (spread over >10s) should not trigger rate limiting."""
        fake_time = 0.0

        def mock_time():
            nonlocal fake_time
            fake_time += 1.0  # 1s between frames = 60 frames in 60s (well under limit)
            return fake_time

        with patch("ws_server.time") as mock_time_module:
            mock_time_module.time = mock_time
            mock_time_module.perf_counter = MagicMock(return_value=0.0)

            with client.websocket_connect("/ws/sign-detection") as ws:
                rate_limit_count = 0
                for _ in range(60):
                    responses = _send_frame_and_collect(ws)
                    for r in responses:
                        if r.get("type") == "error" and "Rate limit" in r.get("message", ""):
                            rate_limit_count += 1

                assert rate_limit_count == 0, "Normal rate should not trigger rate limiting"

    def test_burst_over_limit_returns_error(self, client):
        """Sending 60+ frames in <10 seconds should trigger rate limit error."""
        fake_time = 100.0

        def mock_time():
            nonlocal fake_time
            fake_time += 0.1  # 0.1s between frames = 60 frames in 6s (over limit)
            return fake_time

        with patch("ws_server.time") as mock_time_module:
            mock_time_module.time = mock_time
            mock_time_module.perf_counter = MagicMock(return_value=0.0)

            with client.websocket_connect("/ws/sign-detection") as ws:
                all_responses = []
                # Send 61 frames — first 60 fill the deque, 61st should be rate limited
                for _ in range(61):
                    responses = _send_frame_and_collect(ws)
                    all_responses.extend(responses)

                rate_limit_errors = [
                    r for r in all_responses
                    if r.get("type") == "error" and "Rate limit" in r.get("message", "")
                ]
                assert len(rate_limit_errors) > 0, "Burst over limit should trigger rate limit error"
                assert "60 frames per 10 seconds" in rate_limit_errors[0]["message"]
