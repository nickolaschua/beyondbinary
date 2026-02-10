"""
Tests for lifespan-based startup in ws_server.

Covers:
(a) /health returns model_loaded status correctly after lifespan startup
(b) server starts without model file and /health returns model_loaded=False

The server should use FastAPI's lifespan context manager (not deprecated
@app.on_event("startup")) for model loading.
"""

import ast
import inspect
import os
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

import ws_server


class TestLifespanStartup:
    """Tests for lifespan-based model loading."""

    def test_uses_lifespan_not_on_event(self):
        """ws_server.app must use lifespan parameter, not @app.on_event('startup')."""
        # Check that the app has a lifespan handler (not None)
        assert ws_server.app.router.lifespan_context is not None, \
            "FastAPI app must have a lifespan context manager set"

        # Check the source code does NOT contain @app.on_event("startup")
        source = inspect.getsource(ws_server)
        assert 'on_event("startup")' not in source and "on_event('startup')" not in source, \
            "ws_server must not use deprecated @app.on_event('startup')"

    def test_health_model_loaded_true_with_model_file(self):
        """After lifespan startup with a valid model file, /health returns model_loaded=True."""
        mock_model = MagicMock()

        with patch("ws_server.tf.keras.models.load_model", return_value=mock_model), \
             patch("ws_server.os.path.isfile", return_value=True):
            with TestClient(ws_server.app, raise_server_exceptions=False) as client:
                response = client.get("/health")
                data = response.json()
                assert data["model_loaded"] is True, \
                    f"Expected model_loaded=True, got {data['model_loaded']}"

        # Clean up
        ws_server.model = None

    def test_health_model_loaded_false_without_model_file(self):
        """After lifespan startup without model file, /health returns model_loaded=False."""
        ws_server.model = None

        with patch("ws_server.os.path.isfile", return_value=False):
            with TestClient(ws_server.app, raise_server_exceptions=False) as client:
                response = client.get("/health")
                data = response.json()
                assert data["model_loaded"] is False, \
                    f"Expected model_loaded=False, got {data['model_loaded']}"

        # Clean up
        ws_server.model = None
