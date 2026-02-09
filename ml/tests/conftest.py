"""
Shared fixtures for SenseAI ML pipeline tests.

Provides mock MediaPipe Holistic results for testing extract_keypoints
without requiring a webcam, GPU, or MediaPipe runtime.
"""

import types

import numpy as np
import pytest


class MockLandmark:
    """Mimics a single MediaPipe landmark with x, y, z, visibility."""

    def __init__(self, x=0.5, y=0.5, z=0.0, visibility=1.0):
        self.x = x
        self.y = y
        self.z = z
        self.visibility = visibility


def _make_landmarks(count, seed=42):
    """Create a list of MockLandmark objects with deterministic values."""
    rng = np.random.RandomState(seed)
    landmarks = []
    for _ in range(count):
        landmarks.append(MockLandmark(
            x=rng.uniform(),
            y=rng.uniform(),
            z=rng.uniform(-1, 1),
            visibility=rng.uniform(),
        ))
    return landmarks


def _landmarks_container(landmarks):
    """Wrap a list of landmarks in an object with a .landmark attribute."""
    container = types.SimpleNamespace()
    container.landmark = landmarks
    return container


@pytest.fixture
def mock_results_all():
    """Mock MediaPipe results with ALL landmarks present (pose, face, lh, rh)."""
    results = types.SimpleNamespace()
    results.pose_landmarks = _landmarks_container(_make_landmarks(33, seed=1))
    results.face_landmarks = _landmarks_container(_make_landmarks(468, seed=2))
    results.left_hand_landmarks = _landmarks_container(_make_landmarks(21, seed=3))
    results.right_hand_landmarks = _landmarks_container(_make_landmarks(21, seed=4))
    return results


@pytest.fixture
def mock_results_none():
    """Mock MediaPipe results with NO landmarks detected."""
    results = types.SimpleNamespace()
    results.pose_landmarks = None
    results.face_landmarks = None
    results.left_hand_landmarks = None
    results.right_hand_landmarks = None
    return results


@pytest.fixture
def mock_results_hands_only():
    """Mock MediaPipe results with only hands detected (no pose/face)."""
    results = types.SimpleNamespace()
    results.pose_landmarks = None
    results.face_landmarks = None
    results.left_hand_landmarks = _landmarks_container(_make_landmarks(21, seed=5))
    results.right_hand_landmarks = _landmarks_container(_make_landmarks(21, seed=6))
    return results
