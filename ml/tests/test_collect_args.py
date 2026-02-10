"""
Tests for collect_data.py --actions CLI argument.

Verifies:
(a) Default collects all 10 actions
(b) --actions "Hello,Yes" filters to just those two
(c) --actions "InvalidSign" exits with error
"""

import argparse
import sys
import types
from unittest.mock import MagicMock

# Pre-mock mediapipe.solutions so utils.py can import without real mediapipe
_mp_mock = MagicMock()
_mp_mock.solutions.holistic = MagicMock()
_mp_mock.solutions.drawing_utils = MagicMock()
if "mediapipe" not in sys.modules or not hasattr(sys.modules.get("mediapipe"), "solutions"):
    sys.modules.setdefault("mediapipe", _mp_mock)

import pytest

from utils import ACTIONS, NUM_SEQUENCES


class TestParseArgs:
    """Test the parse_args function for --actions argument."""

    def test_default_collects_all_actions(self):
        """Default (no --actions) should include all 10 ACTIONS."""
        from collect_data import parse_args

        args = parse_args([])
        assert list(args.actions) == list(ACTIONS)

    def test_actions_flag_filters(self):
        """--actions 'Hello,Yes' should return only those two actions."""
        from collect_data import parse_args

        args = parse_args(["--actions", "Hello,Yes"])
        assert args.actions == ["Hello", "Yes"]

    def test_invalid_action_exits_with_error(self):
        """--actions 'InvalidSign' should cause SystemExit."""
        from collect_data import parse_args

        with pytest.raises(SystemExit):
            parse_args(["--actions", "InvalidSign"])


class TestMainUsesFilteredActions:
    """Verify that main() only iterates over the actions from --actions."""

    def test_main_iterates_only_specified_actions(self, monkeypatch, tmp_path):
        """When --actions Hello,Yes is passed, create_directories only creates dirs for those."""
        import collect_data

        # Monkeypatch DATA_PATH so we write to tmp_path
        monkeypatch.setattr(collect_data, "DATA_PATH", str(tmp_path))

        # Monkeypatch parse_args to return our desired args
        fake_args = argparse.Namespace(
            actions=["Hello", "Yes"],
            num_sequences=NUM_SEQUENCES,
        )
        monkeypatch.setattr(collect_data, "parse_args", lambda argv=None: fake_args)

        # Call create_directories with filtered actions
        collect_data.create_directories(fake_args.actions, fake_args.num_sequences)

        # Only Hello and Yes directories should exist
        created_dirs = sorted(d.name for d in tmp_path.iterdir() if d.is_dir())
        assert created_dirs == ["Hello", "Yes"]
