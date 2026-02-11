"""
SenseAI — Shared Utility Functions
====================================
Shared constants and functions used by all ML pipeline scripts:
collect_data.py, test_realtime.py, ws_server.py, and the training notebook.

CRITICAL CONTRACT:
- extract_keypoints returns shape (1662,)
- Keypoint order: [pose, face, lh, rh] — DO NOT CHANGE
- All scripts import from this module to ensure consistency
"""

import os
from collections import deque
from typing import Any

import cv2
import mediapipe as mp
import numpy as np

# ========================
# SHARED CONSTANTS
# ========================

_ML_DIR = os.path.dirname(os.path.abspath(__file__))

_ACTIONS_PATH = os.path.join(_ML_DIR, 'models', 'actions.npy')
if os.path.isfile(_ACTIONS_PATH):
    ACTIONS = np.load(_ACTIONS_PATH)
else:
    ACTIONS = np.array(['Hello', 'Thank_You', 'Help', 'Yes', 'No',
                        'Please', 'Sorry', 'I_Love_You', 'Stop', 'More',
                        'How_Are_You', 'Good'])

SEQUENCE_LENGTH = 30
NUM_SEQUENCES = 90

DATA_PATH = os.path.join(_ML_DIR, 'MP_Data')
MODEL_PATH = os.path.join(_ML_DIR, 'models', 'action_model.h5')
TFLITE_MODEL_PATH = os.path.join(_ML_DIR, 'models', 'action_model.tflite')

# --- Safe env var parsing helpers ---

def _safe_int(env_key: str, default: int) -> int:
    """Parse an environment variable as int, returning *default* on failure.

    Args:
        env_key: Name of the environment variable.
        default: Value returned when the variable is unset or non-numeric.

    Returns:
        Parsed integer or *default*.
    """
    raw = os.environ.get(env_key)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _safe_float(env_key: str, default: float) -> float:
    """Parse an environment variable as float, returning *default* on failure.

    Args:
        env_key: Name of the environment variable.
        default: Value returned when the variable is unset or non-numeric.

    Returns:
        Parsed float or *default*.
    """
    raw = os.environ.get(env_key)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


# --- Server / runtime configuration (overridable via environment variables) ---
HOST = os.environ.get("SENSEAI_HOST", "0.0.0.0")
PORT = _safe_int("SENSEAI_PORT", 8001)
CONFIDENCE_THRESHOLD = _safe_float("SENSEAI_CONFIDENCE_THRESHOLD", 0.5)
STABILITY_WINDOW = _safe_int("SENSEAI_STABILITY_WINDOW", 5)

SENTENCE_TIMEOUT = _safe_float("SENSEAI_SENTENCE_TIMEOUT", 2.0)

CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.environ.get(
        'SENSEAI_CORS_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000',
    ).split(',')
    if origin.strip()
]

API_KEY: str | None = os.environ.get('SENSEAI_API_KEY')  # None = auth disabled

# MediaPipe setup
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils


# ========================
# DETECTION
# ========================

def mediapipe_detection(image: np.ndarray, model: Any) -> tuple[np.ndarray, Any]:
    """
    Run MediaPipe Holistic detection on a BGR frame.

    Args:
        image: BGR frame from OpenCV (np.ndarray)
        model: MediaPipe Holistic instance

    Returns:
        tuple: (BGR image for display, MediaPipe results object)
    """
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image.flags.writeable = False
    results = model.process(image)
    image.flags.writeable = True
    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    return image, results


# ========================
# VISUALIZATION
# ========================

def draw_landmarks(image: np.ndarray, results: Any) -> None:
    """
    Draw all detected landmarks on frame for visual feedback.

    Uses FACEMESH_CONTOURS (not deprecated FACE_CONNECTIONS).

    Color scheme:
    - Face: green tones
    - Pose: red/purple tones
    - Left hand: pink/purple
    - Right hand: orange/pink
    """
    if results.face_landmarks:
        mp_drawing.draw_landmarks(
            image, results.face_landmarks, mp_holistic.FACEMESH_CONTOURS,
            mp_drawing.DrawingSpec(color=(80, 110, 10), thickness=1, circle_radius=1),
            mp_drawing.DrawingSpec(color=(80, 256, 121), thickness=1, circle_radius=1)
        )
    if results.pose_landmarks:
        mp_drawing.draw_landmarks(
            image, results.pose_landmarks, mp_holistic.POSE_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(80, 22, 10), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(80, 44, 121), thickness=2, circle_radius=2)
        )
    if results.left_hand_landmarks:
        mp_drawing.draw_landmarks(
            image, results.left_hand_landmarks, mp_holistic.HAND_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(121, 22, 76), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(121, 44, 250), thickness=2, circle_radius=2)
        )
    if results.right_hand_landmarks:
        mp_drawing.draw_landmarks(
            image, results.right_hand_landmarks, mp_holistic.HAND_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(245, 117, 66), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(245, 66, 230), thickness=2, circle_radius=2)
        )


# ========================
# KEYPOINT EXTRACTION
# ========================

def extract_keypoints(results: Any) -> np.ndarray:
    """
    Extract all landmarks into a flat numpy array of length 1662.

    Order: [pose, face, lh, rh]  <-- CRITICAL, do not change

    Breakdown:
    - Pose: 33 landmarks x 4 (x, y, z, visibility) = 132
    - Face: 468 landmarks x 3 (x, y, z) = 1404
    - Left hand: 21 landmarks x 3 (x, y, z) = 63
    - Right hand: 21 landmarks x 3 (x, y, z) = 63
    Total: 132 + 1404 + 63 + 63 = 1662

    If a body part is not detected, returns zeros for that section.
    This is critical — the LSTM needs fixed-size input.

    Args:
        results: MediaPipe Holistic results object

    Returns:
        np.ndarray: Flat array of shape (1662,)
    """
    pose = np.array(
        [[res.x, res.y, res.z, res.visibility] for res in results.pose_landmarks.landmark]
    ).flatten() if results.pose_landmarks else np.zeros(33 * 4)

    face = np.array(
        [[res.x, res.y, res.z] for res in results.face_landmarks.landmark]
    ).flatten() if results.face_landmarks else np.zeros(468 * 3)

    lh = np.array(
        [[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]
    ).flatten() if results.left_hand_landmarks else np.zeros(21 * 3)

    rh = np.array(
        [[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]
    ).flatten() if results.right_hand_landmarks else np.zeros(21 * 3)

    result = np.concatenate([pose, face, lh, rh])
    assert result.shape == (1662,), f"extract_keypoints produced shape {result.shape}, expected (1662,)"
    return result


# ========================
# KEYPOINT PREPROCESSING
# ========================

# Features after face stripping: pose(132) + lh(63) + rh(63)
NUM_FEATURES = 258


def strip_face_features(keypoints: np.ndarray) -> np.ndarray:
    """Strip face landmarks from a 1662-feature vector, returning 258 features.

    Layout: [pose 0:132, face 132:1536, lh 1536:1599, rh 1599:1662]
    Output: [pose(132), lh(63), rh(63)]

    Args:
        keypoints: Flat array of shape (1662,)

    Returns:
        np.ndarray: Flat array of shape (258,)
    """
    pose = keypoints[:132]
    lh = keypoints[1536:1599]
    rh = keypoints[1599:1662]
    return np.concatenate([pose, lh, rh])


def normalize_frame(frame: np.ndarray) -> np.ndarray:
    """Normalize a 258-feature frame: center on nose, scale by shoulder width.

    Makes the model position- and scale-invariant so signer location
    in the camera frame doesn't affect predictions.

    Args:
        frame: Flat array of shape (258,) — [pose(132), lh(63), rh(63)]

    Returns:
        np.ndarray: Normalized flat array of shape (258,)
    """
    pose = frame[:132].reshape(33, 4)
    lh = frame[132:195].reshape(21, 3)
    rh = frame[195:258].reshape(21, 3)

    anchor = pose[0, :3]  # nose xyz

    # Center pose xyz (leave visibility alone)
    pose[:, :3] -= anchor
    # Center hands
    lh -= anchor
    rh -= anchor

    # Scale by shoulder width for size invariance
    l_shoulder = pose[11, :3]
    r_shoulder = pose[12, :3]
    scale = np.linalg.norm(l_shoulder - r_shoulder)
    if scale > 1e-6:
        pose[:, :3] /= scale
        lh /= scale
        rh /= scale

    return np.concatenate([pose.flatten(), lh.flatten(), rh.flatten()])


def prepare_keypoints(keypoints: np.ndarray) -> np.ndarray:
    """Full preprocessing: strip face features and normalize landmarks.

    Args:
        keypoints: Raw 1662-feature vector from extract_keypoints().

    Returns:
        np.ndarray: Preprocessed 258-feature vector ready for the model.
    """
    stripped = strip_face_features(keypoints)
    return normalize_frame(stripped)


# ========================
# STABILITY FILTER
# ========================

class StabilityFilter:
    """Stabilize predictions by requiring N consecutive identical results above a threshold.

    Args:
        window_size: Number of consecutive identical predictions required.
        threshold: Minimum confidence to accept a prediction.
    """

    def __init__(self, window_size: int = 8, threshold: float = 0.7):
        self.window_size = window_size
        self.threshold = threshold
        self._history = deque(maxlen=window_size)
        self._current_sign = None

    def update(self, sign: str, confidence: float) -> dict:
        """Process a new prediction and return stability status.

        Args:
            sign: The predicted sign label.
            confidence: The prediction confidence (0-1).

        Returns:
            dict with keys: is_stable, is_new_sign, sign
        """
        if confidence >= self.threshold:
            self._history.append(sign)
        else:
            self._history.append(None)

        is_stable = (
            len(self._history) == self.window_size
            and len(set(self._history)) == 1
            and self._history[0] is not None
        )

        is_new_sign = False
        if is_stable:
            stable_sign = self._history[0]
            if stable_sign != self._current_sign:
                is_new_sign = True
                self._current_sign = stable_sign

        return {
            "is_stable": is_stable,
            "is_new_sign": is_new_sign,
            "sign": self._history[0] if is_stable else sign,
        }
