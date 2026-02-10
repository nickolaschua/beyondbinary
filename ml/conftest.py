"""
Root conftest for ml/ — patches mediapipe.solutions before any test imports utils.py.

mediapipe >= 0.10.22 removed mp.solutions.holistic (legacy API).
Since our test environment uses a newer mediapipe, we mock the attribute
so that utils.py module-level code can execute without error.
"""

import sys
import types
import unittest.mock as mock


def _ensure_mediapipe_solutions():
    """Patch mediapipe.solutions.holistic if it doesn't exist."""
    try:
        import mediapipe as mp
        _ = mp.solutions.holistic
    except AttributeError:
        # Create a mock solutions.holistic module
        solutions = types.ModuleType("mediapipe.solutions")
        holistic = types.ModuleType("mediapipe.solutions.holistic")

        # Provide minimal attributes that utils.py references
        holistic.FACEMESH_CONTOURS = None
        holistic.POSE_CONNECTIONS = None
        holistic.HAND_CONNECTIONS = None
        holistic.Holistic = mock.MagicMock

        solutions.holistic = holistic
        solutions.drawing_utils = mock.MagicMock()

        import mediapipe as mp
        mp.solutions = solutions

        sys.modules["mediapipe.solutions"] = solutions
        sys.modules["mediapipe.solutions.holistic"] = holistic


_ensure_mediapipe_solutions()
