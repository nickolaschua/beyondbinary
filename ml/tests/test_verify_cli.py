"""Tests for verify_data.py CLI argument parsing."""

import sys
import os

# Ensure ml/ is on path so verify_data can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils import DATA_PATH


def test_default_data_path_matches_utils():
    """Default --data_path should match utils.DATA_PATH."""
    from verify_data import parse_args

    args = parse_args([])
    assert args.data_path == DATA_PATH


def test_default_min_hands_is_15():
    """Default --min_hands should be 15."""
    from verify_data import parse_args

    args = parse_args([])
    assert args.min_hands == 15


def test_min_hands_custom_value():
    """--min_hands 10 should set threshold to 10."""
    from verify_data import parse_args

    args = parse_args(["--min_hands", "10"])
    assert args.min_hands == 10
