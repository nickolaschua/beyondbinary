"""
Smoke tests — verify basic infrastructure works.

Tests:
- ACTIONS has exactly 10 items
- extract_keypoints returns shape (1662,)
"""

import numpy as np

from utils import ACTIONS, extract_keypoints


def test_actions_has_12_items():
    """ACTIONS array must contain exactly 12 ASL signs."""
    assert len(ACTIONS) == 12


def test_actions_are_strings():
    """Every action must be a non-empty string."""
    for action in ACTIONS:
        assert isinstance(action, str)
        assert len(action) > 0


def test_extract_keypoints_shape(mock_results_all):
    """extract_keypoints must return a flat array of shape (1662,)."""
    keypoints = extract_keypoints(mock_results_all)
    assert isinstance(keypoints, np.ndarray)
    assert keypoints.shape == (1662,)


def test_extract_keypoints_returns_numpy(mock_results_none):
    """extract_keypoints must return a numpy array even with no detections."""
    keypoints = extract_keypoints(mock_results_none)
    assert isinstance(keypoints, np.ndarray)
    assert keypoints.shape == (1662,)
