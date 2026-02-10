"""
Tests for StabilityFilter class.

Covers:
(a) N consecutive identical predictions above threshold → is_stable=True
(b) Mixed predictions → is_stable=False
(c) Predictions below threshold → reset/not stable
"""

import pytest

from utils import StabilityFilter


class TestConsecutiveIdentical:
    """(a) N consecutive identical predictions above threshold → is_stable."""

    def test_becomes_stable_after_n_identical(self):
        sf = StabilityFilter(window_size=5, threshold=0.7)
        # Push 5 identical "Hello" predictions above threshold
        for _ in range(4):
            result = sf.update("Hello", 0.9)
            assert not result["is_stable"]
        result = sf.update("Hello", 0.9)
        assert result["is_stable"]
        assert result["sign"] == "Hello"

    def test_first_stable_is_new_sign(self):
        sf = StabilityFilter(window_size=3, threshold=0.7)
        for _ in range(2):
            sf.update("Hello", 0.9)
        result = sf.update("Hello", 0.9)
        assert result["is_stable"]
        assert result["is_new_sign"]

    def test_repeated_stable_same_sign_is_not_new(self):
        sf = StabilityFilter(window_size=3, threshold=0.7)
        # First stabilize on "Hello"
        for _ in range(3):
            sf.update("Hello", 0.9)
        # Continue pushing "Hello" — should be stable but not new
        result = sf.update("Hello", 0.9)
        assert result["is_stable"]
        assert not result["is_new_sign"]

    def test_different_sign_after_stable_is_new(self):
        sf = StabilityFilter(window_size=3, threshold=0.7)
        # Stabilize on "Hello"
        for _ in range(3):
            sf.update("Hello", 0.9)
        # Now switch to "Yes"
        for _ in range(3):
            result = sf.update("Yes", 0.9)
        assert result["is_stable"]
        assert result["is_new_sign"]
        assert result["sign"] == "Yes"


class TestMixedPredictions:
    """(b) Mixed predictions → is_stable=False."""

    def test_alternating_signs_not_stable(self):
        sf = StabilityFilter(window_size=3, threshold=0.7)
        sf.update("Hello", 0.9)
        sf.update("Yes", 0.9)
        result = sf.update("Hello", 0.9)
        assert not result["is_stable"]

    def test_single_different_breaks_stability(self):
        sf = StabilityFilter(window_size=4, threshold=0.7)
        sf.update("Hello", 0.9)
        sf.update("Hello", 0.9)
        sf.update("Yes", 0.9)  # breaks streak
        result = sf.update("Hello", 0.9)
        assert not result["is_stable"]


class TestBelowThreshold:
    """(c) Predictions below threshold → resets stability."""

    def test_below_threshold_not_stable(self):
        sf = StabilityFilter(window_size=3, threshold=0.7)
        sf.update("Hello", 0.9)
        sf.update("Hello", 0.9)
        # Below threshold breaks the streak
        result = sf.update("Hello", 0.3)
        assert not result["is_stable"]

    def test_below_threshold_resets_streak(self):
        sf = StabilityFilter(window_size=3, threshold=0.7)
        sf.update("Hello", 0.9)
        sf.update("Hello", 0.9)
        sf.update("Hello", 0.3)  # below threshold — resets
        # Need 3 more above threshold
        sf.update("Hello", 0.9)
        sf.update("Hello", 0.9)
        result = sf.update("Hello", 0.9)
        assert result["is_stable"]

    def test_all_below_threshold_not_stable(self):
        sf = StabilityFilter(window_size=3, threshold=0.7)
        for _ in range(5):
            result = sf.update("Hello", 0.5)
        assert not result["is_stable"]
