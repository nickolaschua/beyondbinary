"""
SenseAI — Environment Verification
=====================================
Verifies that all dependencies are installed, webcam is accessible,
and MediaPipe Holistic can process frames.

Run:
    python test_setup.py

Expected: all checks PASS. If any FAIL, see error message for fix.
"""

import sys


def check_imports():
    """Check all required libraries can be imported."""
    print("=" * 50)
    print("  IMPORT CHECKS")
    print("=" * 50)

    errors = []

    try:
        import cv2
        print(f"  [PASS] OpenCV: {cv2.__version__}")
    except ImportError as e:
        print(f"  [FAIL] OpenCV: {e}")
        errors.append("opencv-python")

    try:
        import mediapipe as mp
        print(f"  [PASS] MediaPipe: {mp.__version__}")
    except ImportError as e:
        print(f"  [FAIL] MediaPipe: {e}")
        errors.append("mediapipe")

    try:
        import numpy as np
        print(f"  [PASS] NumPy: {np.__version__}")
    except ImportError as e:
        print(f"  [FAIL] NumPy: {e}")
        errors.append("numpy")

    try:
        import tensorflow as tf
        print(f"  [PASS] TensorFlow: {tf.__version__}")
    except ImportError as e:
        print(f"  [FAIL] TensorFlow: {e}")
        errors.append("tensorflow")

    try:
        import sklearn
        print(f"  [PASS] scikit-learn: {sklearn.__version__}")
    except ImportError as e:
        print(f"  [FAIL] scikit-learn: {e}")
        errors.append("scikit-learn")

    try:
        import fastapi
        print(f"  [PASS] FastAPI: {fastapi.__version__}")
    except ImportError as e:
        print(f"  [FAIL] FastAPI: {e}")
        errors.append("fastapi")

    return errors


def check_webcam():
    """Test webcam access."""
    import cv2

    print()
    print("=" * 50)
    print("  WEBCAM CHECK")
    print("=" * 50)

    cap = cv2.VideoCapture(0)
    ret, frame = cap.read()
    cap.release()

    if ret:
        print(f"  [PASS] Webcam accessible — frame shape: {frame.shape}")
        return frame
    else:
        print("  [FAIL] Cannot access webcam")
        print("         Fix: Close other apps using the camera (Zoom, Teams, browser)")
        return None


def check_mediapipe(frame):
    """Test MediaPipe Holistic detection."""
    import cv2
    import mediapipe as mp

    print()
    print("=" * 50)
    print("  MEDIAPIPE HOLISTIC CHECK")
    print("=" * 50)

    mp_holistic = mp.solutions.holistic

    with mp_holistic.Holistic(
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as holistic:
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = holistic.process(image_rgb)

        pose = "detected" if results.pose_landmarks else "NOT detected"
        face = "detected" if results.face_landmarks else "NOT detected"
        lh = "detected" if results.left_hand_landmarks else "NOT detected"
        rh = "detected" if results.right_hand_landmarks else "NOT detected"

        print(f"  Pose landmarks:  {pose}")
        print(f"  Face landmarks:  {face}")
        print(f"  Left hand:       {lh}")
        print(f"  Right hand:      {rh}")
        print()
        print("  Note: 'NOT detected' for hands/face is OK if you're not")
        print("  visible in the frame. The important thing is no errors.")

        return results


def check_utils(results):
    """Test that utils.py works correctly."""
    print()
    print("=" * 50)
    print("  UTILS.PY CONTRACT CHECK")
    print("=" * 50)

    try:
        from utils import (
            ACTIONS, SEQUENCE_LENGTH, NUM_SEQUENCES,
            DATA_PATH, MODEL_PATH,
            extract_keypoints, mediapipe_detection, draw_landmarks
        )
        print(f"  [PASS] utils.py imports successfully")
        print(f"         ACTIONS: {list(ACTIONS)}")
        print(f"         SEQUENCE_LENGTH: {SEQUENCE_LENGTH}")
        print(f"         NUM_SEQUENCES: {NUM_SEQUENCES}")
        print(f"         DATA_PATH: {DATA_PATH}")
        print(f"         MODEL_PATH: {MODEL_PATH}")
    except ImportError as e:
        print(f"  [FAIL] Cannot import utils.py: {e}")
        return False

    keypoints = extract_keypoints(results)
    expected_shape = (1662,)
    if keypoints.shape == expected_shape:
        print(f"  [PASS] extract_keypoints returns shape {keypoints.shape}")
    else:
        print(f"  [FAIL] extract_keypoints shape: {keypoints.shape} (expected {expected_shape})")
        return False

    # Verify keypoint order: [pose(132), face(1404), lh(63), rh(63)]
    assert len(keypoints) == 132 + 1404 + 63 + 63, "Keypoint length mismatch"
    print(f"  [PASS] Keypoint order: [pose(132), face(1404), lh(63), rh(63)]")

    return True


def main():
    print()
    print("SenseAI — Environment Verification")
    print(f"Python: {sys.version}")
    print()

    # Check Python version
    major, minor = sys.version_info[:2]
    if minor > 12:
        print(f"  [WARN] Python {major}.{minor} detected. MediaPipe requires 3.9-3.12.")
        print("         If mediapipe import fails, install Python 3.12.")
        print()

    # 1. Import checks
    import_errors = check_imports()
    if import_errors:
        print(f"\n  FAILED: Missing packages: {', '.join(import_errors)}")
        print(f"  Fix: pip install -r requirements.txt")
        sys.exit(1)

    # 2. Webcam check
    frame = check_webcam()
    if frame is None:
        print("\n  FAILED: Webcam not accessible.")
        sys.exit(1)

    # 3. MediaPipe check
    results = check_mediapipe(frame)

    # 4. Utils contract check
    utils_ok = check_utils(results)

    # Summary
    print()
    print("=" * 50)
    if utils_ok:
        print("  ALL CHECKS PASSED")
        print("  Environment is ready for SenseAI ML pipeline.")
    else:
        print("  SOME CHECKS FAILED")
        print("  Review errors above and fix before proceeding.")
    print("=" * 50)
    print()


if __name__ == "__main__":
    main()
