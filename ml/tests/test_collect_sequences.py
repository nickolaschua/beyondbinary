"""
Tests for collect_data.py --num_sequences CLI argument.

Verifies:
(a) Default equals utils.NUM_SEQUENCES (30)
(b) --num_sequences 5 sets the value to 5
(c) create_directories uses the CLI value by checking directory creation
    with tmp_path and monkeypatched DATA_PATH
"""

import sys
from unittest.mock import MagicMock

# Pre-mock mediapipe.solutions so utils.py can import without real mediapipe
_mp_mock = MagicMock()
_mp_mock.solutions.holistic = MagicMock()
_mp_mock.solutions.drawing_utils = MagicMock()
if "mediapipe" not in sys.modules or not hasattr(sys.modules.get("mediapipe"), "solutions"):
    sys.modules.setdefault("mediapipe", _mp_mock)

import pytest

from utils import NUM_SEQUENCES


class TestParseArgsNumSequences:
    """Test parse_args for --num_sequences argument."""

    def test_default_equals_utils_num_sequences(self):
        """Default (no --num_sequences) should equal utils.NUM_SEQUENCES (30)."""
        from collect_data import parse_args

        args = parse_args([])
        assert args.num_sequences == NUM_SEQUENCES

    def test_num_sequences_flag_overrides(self):
        """--num_sequences 5 should set the value to 5."""
        from collect_data import parse_args

        args = parse_args(["--num_sequences", "5"])
        assert args.num_sequences == 5


class TestCreateDirectoriesUsesCliValue:
    """Verify create_directories respects the --num_sequences value."""

    def test_create_directories_with_custom_num_sequences(self, monkeypatch, tmp_path):
        """create_directories with num_sequences=3 creates exactly 3 sequence dirs per action."""
        import collect_data

        monkeypatch.setattr(collect_data, "DATA_PATH", str(tmp_path))

        collect_data.create_directories(actions=["Hello"], num_sequences=3)

        hello_dir = tmp_path / "Hello"
        seq_dirs = sorted(d.name for d in hello_dir.iterdir() if d.is_dir())
        assert seq_dirs == ["0", "1", "2"]


class TestMainUsesNumSequencesArg:
    """Verify main() uses --num_sequences from CLI instead of the constant."""

    def test_main_passes_num_sequences_to_create_directories(self, monkeypatch):
        """main() should pass args.num_sequences to create_directories."""
        import collect_data
        import argparse

        fake_args = argparse.Namespace(
            actions=["Hello"],
            num_sequences=5,
        )
        monkeypatch.setattr(collect_data, "parse_args", lambda argv=None: fake_args)

        called_with = {}

        def mock_create_dirs(actions=None, num_sequences=None):
            called_with["actions"] = actions
            called_with["num_sequences"] = num_sequences

        monkeypatch.setattr(collect_data, "create_directories", mock_create_dirs)

        # Mock cv2.VideoCapture to avoid webcam access
        mock_cap = MagicMock()
        mock_cap.read.return_value = (False, None)
        monkeypatch.setattr("cv2.VideoCapture", lambda *a: mock_cap)
        monkeypatch.setattr("cv2.destroyAllWindows", lambda: None)

        # Mock mediapipe holistic context manager
        mock_holistic_cls = MagicMock()
        mock_holistic_instance = MagicMock()
        mock_holistic_instance.__enter__ = MagicMock(return_value=mock_holistic_instance)
        mock_holistic_instance.__exit__ = MagicMock(return_value=False)
        mock_holistic_cls.Holistic.return_value = mock_holistic_instance
        monkeypatch.setattr(collect_data, "mp", MagicMock(solutions=MagicMock(holistic=mock_holistic_cls)))

        collect_data.main()

        assert called_with["num_sequences"] == 5
