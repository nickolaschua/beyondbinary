"""
Tests for ws_server FastAPI endpoints.

Covers:
(a) /health returns status "ok" with model_loaded=False when no model is loaded
(b) /health returns correct actions list
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

import ws_server


@pytest.fixture
def client():
    """TestClient that does NOT trigger startup events (no model loading)."""
    # Ensure model is None (no model file available)
    ws_server.model = None
    with TestClient(ws_server.app, raise_server_exceptions=False) as c:
        yield c
    # Reset after test
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
