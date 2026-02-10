"""
Tests for runtime keypoint shape assertion in extract_keypoints().

Covers:
(a) Normal extraction with mock results returns (1662,) without error
(b) Monkeypatch np.concatenate to return wrong shape → raises AssertionError
    with the shape info in the message
"""

import numpy as np
import pytest

from utils import extract_keypoints


class TestKeypointShapeAssertion:
    """Verify extract_keypoints enforces shape (1662,) via assertion."""

    def test_normal_extraction_no_assertion_error(self, mock_results_all):
        """(a) Normal mock results produce (1662,) without raising."""
        result = extract_keypoints(mock_results_all)
        assert result.shape == (1662,)

    def test_wrong_shape_raises_assertion_error(self, mock_results_all, monkeypatch):
        """(b) If np.concatenate returns wrong shape, AssertionError is raised."""
        original_concat = np.concatenate

        def bad_concatenate(arrays, *args, **kwargs):
            # Call the real concatenate then chop it to produce wrong shape
            real = original_concat(arrays, *args, **kwargs)
            return real[:100]  # shape (100,) instead of (1662,)

        monkeypatch.setattr(np, "concatenate", bad_concatenate)

        with pytest.raises(AssertionError, match=r"extract_keypoints produced shape.*expected \(1662,\)"):
            extract_keypoints(mock_results_all)
