"""
Tests for test_realtime.py CLI arguments: --model_path, --confidence, --window.

Verifies:
(a) Default --model_path matches utils.MODEL_PATH
(b) --model_path "/tmp/custom.h5" overrides the default
(c) --confidence and --window default to utils values
"""

import sys
from unittest.mock import MagicMock

# Pre-mock heavy dependencies so test_realtime.py can be imported without them
_tf_mock = MagicMock()
sys.modules.setdefault("tensorflow", _tf_mock)

_cv2_mock = MagicMock()
sys.modules.setdefault("cv2", _cv2_mock)

_mp_mock = MagicMock()
_mp_mock.solutions.holistic = MagicMock()
_mp_mock.solutions.drawing_utils = MagicMock()
sys.modules.setdefault("mediapipe", _mp_mock)

import pytest

from utils import MODEL_PATH, CONFIDENCE_THRESHOLD, STABILITY_WINDOW


class TestRealtimeParseArgs:
    """Test the parse_args function for --model_path, --confidence, --window."""

    def test_default_model_path_matches_utils(self):
        """Default --model_path should equal utils.MODEL_PATH."""
        from test_realtime import parse_args

        args = parse_args([])
        assert args.model_path == MODEL_PATH

    def test_model_path_override(self):
        """--model_path '/tmp/custom.h5' should override the default."""
        from test_realtime import parse_args

        args = parse_args(["--model_path", "/tmp/custom.h5"])
        assert args.model_path == "/tmp/custom.h5"

    def test_default_confidence_matches_utils(self):
        """Default --confidence should equal utils.CONFIDENCE_THRESHOLD."""
        from test_realtime import parse_args

        args = parse_args([])
        assert args.confidence == CONFIDENCE_THRESHOLD

    def test_default_window_matches_utils(self):
        """Default --window should equal utils.STABILITY_WINDOW."""
        from test_realtime import parse_args

        args = parse_args([])
        assert args.window == STABILITY_WINDOW

    def test_confidence_override(self):
        """--confidence 0.5 should set the value to 0.5."""
        from test_realtime import parse_args

        args = parse_args(["--confidence", "0.5"])
        assert args.confidence == 0.5

    def test_window_override(self):
        """--window 3 should set the value to 3."""
        from test_realtime import parse_args

        args = parse_args(["--window", "3"])
        assert args.window == 3
