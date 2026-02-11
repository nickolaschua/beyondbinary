"""
Tests for centralized configuration with environment variable overrides.

Covers:
(a) Default values match current hardcoded values
(b) Environment variables override defaults using monkeypatch
(c) MODEL_PATH resolves correctly regardless of cwd
(d) Invalid env var values fall back to defaults
(e) CORS_ORIGINS configurable via SENSEAI_CORS_ORIGINS
(f) API_KEY disabled by default, enabled via SENSEAI_API_KEY
"""

import os

import pytest


class TestConfigDefaults:
    """Verify default configuration values match expected hardcoded values."""

    def test_host_default(self):
        from utils import HOST
        assert HOST == "0.0.0.0"

    def test_port_default(self):
        from utils import PORT
        assert PORT == 8001

    def test_confidence_threshold_default(self):
        from utils import CONFIDENCE_THRESHOLD
        assert CONFIDENCE_THRESHOLD == 0.5

    def test_stability_window_default(self):
        from utils import STABILITY_WINDOW
        assert STABILITY_WINDOW == 5

    def test_model_path_is_absolute(self):
        from utils import MODEL_PATH
        assert os.path.isabs(MODEL_PATH)

    def test_model_path_ends_correctly(self):
        from utils import MODEL_PATH
        assert MODEL_PATH.endswith(os.path.join("models", "action_model.h5"))


class TestConfigEnvOverrides:
    """Verify environment variables override defaults."""

    def test_host_env_override(self, monkeypatch):
        monkeypatch.setenv("SENSEAI_HOST", "127.0.0.1")
        # Re-import to pick up env var — need to reload the module
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.HOST == "127.0.0.1"

    def test_port_env_override(self, monkeypatch):
        monkeypatch.setenv("SENSEAI_PORT", "9999")
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.PORT == 9999

    def test_confidence_threshold_env_override(self, monkeypatch):
        monkeypatch.setenv("SENSEAI_CONFIDENCE_THRESHOLD", "0.85")
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.CONFIDENCE_THRESHOLD == 0.85

    def test_stability_window_env_override(self, monkeypatch):
        monkeypatch.setenv("SENSEAI_STABILITY_WINDOW", "12")
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.STABILITY_WINDOW == 12

    def teardown_method(self):
        """Reload utils with clean environment after each test."""
        import importlib
        import utils
        # Remove any SENSEAI_ env vars that might linger
        for key in list(os.environ):
            if key.startswith("SENSEAI_"):
                del os.environ[key]
        importlib.reload(utils)


class TestConfigInvalidEnvVars:
    """Verify invalid environment variable values fall back to defaults."""

    def test_invalid_port_falls_back_to_default(self, monkeypatch):
        """Non-numeric SENSEAI_PORT should fall back to 8001."""
        monkeypatch.setenv("SENSEAI_PORT", "abc")
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.PORT == 8001

    def test_invalid_confidence_threshold_falls_back_to_default(self, monkeypatch):
        """Non-numeric SENSEAI_CONFIDENCE_THRESHOLD should fall back to 0.7."""
        monkeypatch.setenv("SENSEAI_CONFIDENCE_THRESHOLD", "notanumber")
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.CONFIDENCE_THRESHOLD == 0.5

    def test_invalid_stability_window_falls_back_to_default(self, monkeypatch):
        """Non-numeric SENSEAI_STABILITY_WINDOW should fall back to 8."""
        monkeypatch.setenv("SENSEAI_STABILITY_WINDOW", "xyz")
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.STABILITY_WINDOW == 5

    def test_empty_port_falls_back_to_default(self, monkeypatch):
        """Empty string SENSEAI_PORT should fall back to 8001."""
        monkeypatch.setenv("SENSEAI_PORT", "")
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.PORT == 8001

    def test_valid_port_still_works(self, monkeypatch):
        """Valid numeric SENSEAI_PORT should still be parsed correctly."""
        monkeypatch.setenv("SENSEAI_PORT", "3000")
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.PORT == 3000

    def test_valid_confidence_threshold_still_works(self, monkeypatch):
        """Valid numeric SENSEAI_CONFIDENCE_THRESHOLD should still be parsed correctly."""
        monkeypatch.setenv("SENSEAI_CONFIDENCE_THRESHOLD", "0.95")
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.CONFIDENCE_THRESHOLD == 0.95

    def teardown_method(self):
        """Reload utils with clean environment after each test."""
        import importlib
        import utils
        for key in list(os.environ):
            if key.startswith("SENSEAI_"):
                del os.environ[key]
        importlib.reload(utils)


class TestCorsOriginsConfig:
    """Verify CORS_ORIGINS is configurable via SENSEAI_CORS_ORIGINS."""

    def test_cors_origins_default(self):
        """Default (no env var) should produce localhost origins."""
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.CORS_ORIGINS == ['http://localhost:3000', 'http://127.0.0.1:3000']

    def test_cors_origins_single_origin(self, monkeypatch):
        """Single origin should produce a one-element list."""
        monkeypatch.setenv('SENSEAI_CORS_ORIGINS', 'http://localhost:3000')
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.CORS_ORIGINS == ['http://localhost:3000']

    def test_cors_origins_multiple_origins(self, monkeypatch):
        """Comma-separated origins should produce a multi-element list."""
        monkeypatch.setenv(
            'SENSEAI_CORS_ORIGINS',
            'http://localhost:3000,http://example.com',
        )
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.CORS_ORIGINS == ['http://localhost:3000', 'http://example.com']

    def test_cors_origins_trims_whitespace(self, monkeypatch):
        """Whitespace around origins should be stripped."""
        monkeypatch.setenv(
            'SENSEAI_CORS_ORIGINS',
            ' http://localhost:3000 , http://example.com ',
        )
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.CORS_ORIGINS == ['http://localhost:3000', 'http://example.com']

    def test_cors_origins_ignores_empty_entries(self, monkeypatch):
        """Trailing commas should not produce empty strings."""
        monkeypatch.setenv('SENSEAI_CORS_ORIGINS', 'http://localhost:3000,,')
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.CORS_ORIGINS == ['http://localhost:3000']

    def teardown_method(self):
        """Reload utils with clean environment after each test."""
        import importlib
        import utils
        for key in list(os.environ):
            if key.startswith('SENSEAI_'):
                del os.environ[key]
        importlib.reload(utils)


class TestApiKeyConfig:
    """Verify API_KEY configuration via SENSEAI_API_KEY."""

    def test_api_key_default_is_none(self):
        """Default (no env var) should be None (auth disabled)."""
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.API_KEY is None

    def test_api_key_set_from_env(self, monkeypatch):
        """Setting SENSEAI_API_KEY should expose the value."""
        monkeypatch.setenv('SENSEAI_API_KEY', 'my-secret-key')
        import importlib
        import utils
        importlib.reload(utils)
        assert utils.API_KEY == 'my-secret-key'

    def teardown_method(self):
        """Reload utils with clean environment after each test."""
        import importlib
        import utils
        for key in list(os.environ):
            if key.startswith('SENSEAI_'):
                del os.environ[key]
        importlib.reload(utils)
