"""
Standalone real-time ASL sign detection from local webcam.

Verifies the trained model works before going to WebSocket serving.
Opens webcam, runs MediaPipe Holistic per frame, feeds 30-frame sliding
window into LSTM model, displays predictions with stability filtering.

Usage:
    python test_realtime.py

Press 'q' to quit.
"""

import argparse

import cv2
import numpy as np
from collections import deque

import tensorflow as tf

from utils import (
    ACTIONS,
    SEQUENCE_LENGTH,
    MODEL_PATH,
    CONFIDENCE_THRESHOLD,
    STABILITY_WINDOW,
    StabilityFilter,
    mediapipe_detection,
    draw_landmarks,
    extract_keypoints,
)


def parse_args(argv=None):
    """Parse command-line arguments for the realtime test script."""
    parser = argparse.ArgumentParser(description="Real-time ASL sign detection from webcam.")
    parser.add_argument(
        "--model_path",
        type=str,
        default=MODEL_PATH,
        help=f"Path to the trained model file (default: {MODEL_PATH})",
    )
    parser.add_argument(
        "--confidence",
        type=float,
        default=CONFIDENCE_THRESHOLD,
        help=f"Minimum confidence threshold (default: {CONFIDENCE_THRESHOLD})",
    )
    parser.add_argument(
        "--window",
        type=int,
        default=STABILITY_WINDOW,
        help=f"Stability window size (default: {STABILITY_WINDOW})",
    )
    return parser.parse_args(argv)

# --- Configuration ---
MAX_SENTENCE_LENGTH = 5       # last N signs displayed

# --- Colors (BGR) ---
ORANGE = (0, 140, 255)
GREEN = (0, 255, 0)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)

# One color per action for probability bars
BAR_COLORS = [
    (245, 117, 16),   # orange
    (117, 245, 16),   # lime
    (16, 117, 245),   # blue
    (16, 245, 245),   # yellow
    (245, 16, 245),   # magenta
    (245, 16, 117),   # pink
    (16, 245, 117),   # teal
    (117, 16, 245),   # purple
    (200, 200, 50),   # olive
    (50, 200, 200),   # cyan
]


def draw_probability_bars(frame, probabilities):
    """Draw horizontal probability bars for each action on the frame."""
    bar_height = 20
    bar_max_width = 200
    x_offset = 10
    y_start = 70

    for i, (action, prob) in enumerate(zip(ACTIONS, probabilities)):
        y = y_start + i * (bar_height + 5)
        color = BAR_COLORS[i % len(BAR_COLORS)]

        # Background bar
        cv2.rectangle(frame, (x_offset, y), (x_offset + bar_max_width, y + bar_height), (50, 50, 50), -1)

        # Filled bar
        bar_width = int(prob * bar_max_width)
        cv2.rectangle(frame, (x_offset, y), (x_offset + bar_width, y + bar_height), color, -1)

        # Label
        label = f"{action}: {prob:.2f}"
        cv2.putText(frame, label, (x_offset + bar_max_width + 10, y + bar_height - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, WHITE, 1, cv2.LINE_AA)


def draw_sentence_bar(frame, sentence):
    """Draw the top orange bar with detected sentence."""
    h, w, _ = frame.shape
    bar_h = 45

    # Orange background bar
    cv2.rectangle(frame, (0, 0), (w, bar_h), ORANGE, -1)

    # Sentence text
    text = " | ".join(sentence) if sentence else "Waiting for signs..."
    cv2.putText(frame, text, (10, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.85, WHITE, 2, cv2.LINE_AA)


def main():
    args = parse_args()

    # Load model
    print(f"Loading model from {args.model_path}...")
    model = tf.keras.models.load_model(args.model_path)
    print(f"Model loaded. Actions: {list(ACTIONS)}")

    # Initialize MediaPipe Holistic
    import mediapipe as mp
    mp_holistic = mp.solutions.holistic

    # Sliding window buffer for keypoint sequences
    keypoint_buffer = deque(maxlen=SEQUENCE_LENGTH)

    # Stability filter
    stability_filter = StabilityFilter(window_size=args.window, threshold=args.confidence)

    # Detected sentence
    sentence = []

    # Frame counter
    frames_processed = 0

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    if not cap.isOpened():
        print("ERROR: Cannot open webcam")
        return

    print("Webcam opened. Press 'q' to quit.")

    with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                print("Failed to read frame")
                break

            # MediaPipe detection
            image, results = mediapipe_detection(frame, holistic)

            # Draw landmarks on frame
            draw_landmarks(image, results)

            # Extract keypoints and add to buffer
            keypoints = extract_keypoints(results)
            keypoint_buffer.append(keypoints)
            frames_processed += 1

            # When buffer is full, run prediction
            if len(keypoint_buffer) == SEQUENCE_LENGTH:
                # Shape: (1, 30, 1662)
                sequence = np.expand_dims(np.array(list(keypoint_buffer)), axis=0)
                predictions = model.predict(sequence, verbose=0)[0]

                predicted_idx = np.argmax(predictions)
                confidence = predictions[predicted_idx]
                predicted_sign = ACTIONS[predicted_idx]

                # Draw probability bars
                draw_probability_bars(image, predictions)

                # Stability filter
                result = stability_filter.update(predicted_sign, float(confidence))

                if result["is_new_sign"]:
                    stable_sign = result["sign"]
                    sentence.append(stable_sign)
                    if len(sentence) > MAX_SENTENCE_LENGTH:
                        sentence = sentence[-MAX_SENTENCE_LENGTH:]
                    print(f"Detected: {stable_sign} ({confidence:.2f})")

            # Draw sentence bar on top
            draw_sentence_bar(image, sentence)

            cv2.imshow("SenseAI - Real-Time Sign Detection", image)

            if cv2.waitKey(10) & 0xFF == ord("q"):
                break

    cap.release()
    cv2.destroyAllWindows()
    print(f"\nSession ended. {frames_processed} frames processed.")
    print(f"Signs detected: {' | '.join(sentence) if sentence else 'None'}")


if __name__ == "__main__":
    main()
