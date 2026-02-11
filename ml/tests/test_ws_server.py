"""
Tests for ws_server FastAPI endpoints.

Covers:
(a) /health returns status "ok" with model_loaded=False when no model is loaded
(b) /health returns correct actions list
(c) Optional API key auth on WebSocket connect
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

import ws_server


@pytest.fixture
def client():
    """TestClient with model explicitly set to None (simulates no model loaded)."""
    with TestClient(ws_server.app, raise_server_exceptions=False) as c:
        # Set model to None AFTER lifespan runs (model file may exist on disk)
        ws_server.model = None
        yield c
    ws_server.model = None


class TestHealthEndpoint:
    """Tests for GET /health."""

    def test_health_returns_ok(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_health_model_loaded_false_when_no_model(self, client):
        response = client.get("/health")
        data = response.json()
        assert data["model_loaded"] is False

    def test_health_returns_actions_list(self, client):
        response = client.get("/health")
        data = response.json()
        assert "actions" in data
        assert len(data["actions"]) == 10
        assert "Hello" in data["actions"]
        assert "Thank_You" in data["actions"]

    def test_health_returns_sequence_length(self, client):
        response = client.get("/health")
        data = response.json()
        assert data["sequence_length"] == 30


class TestWebSocketAuthNoKey:
    """When SENSEAI_API_KEY is not set, auth is disabled."""

    def test_ws_accepts_without_key_when_auth_disabled(self, client):
        """Connection should be accepted with no API key when auth is off."""
        original = ws_server.API_KEY
        ws_server.API_KEY = None
        try:
            with client.websocket_connect('/ws/sign-detection') as ws:
                # Connection accepted — send a minimal message so we know it works
                ws.send_json({'type': 'ping'})
                resp = ws.receive_json()
                assert resp['type'] == 'error'  # unknown type, but connection is alive
        finally:
            ws_server.API_KEY = original


class TestWebSocketAuthWithKey:
    """When SENSEAI_API_KEY is set, only matching keys are accepted."""

    def test_ws_accepts_correct_key(self, client):
        """Connection with the correct api_key query param should be accepted."""
        original = ws_server.API_KEY
        ws_server.API_KEY = 'test-secret'
        try:
            with client.websocket_connect(
                '/ws/sign-detection?api_key=test-secret'
            ) as ws:
                ws.send_json({'type': 'ping'})
                resp = ws.receive_json()
                assert resp['type'] == 'error'  # unknown type, but connection is alive
        finally:
            ws_server.API_KEY = original

    def test_ws_rejects_missing_key(self, client):
        """Connection without api_key should be rejected with code 4003."""
        original = ws_server.API_KEY
        ws_server.API_KEY = 'test-secret'
        try:
            with pytest.raises(Exception):
                with client.websocket_connect('/ws/sign-detection') as ws:
                    ws.receive_json()
        finally:
            ws_server.API_KEY = original

    def test_ws_rejects_wrong_key(self, client):
        """Connection with an incorrect api_key should be rejected with code 4003."""
        original = ws_server.API_KEY
        ws_server.API_KEY = 'test-secret'
        try:
            with pytest.raises(Exception):
                with client.websocket_connect(
                    '/ws/sign-detection?api_key=wrong-key'
                ) as ws:
                    ws.receive_json()
        finally:
            ws_server.API_KEY = original
