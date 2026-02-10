"""
SenseAI Data Collection Script

Records ASL sign keypoints from webcam using MediaPipe Holistic.
For each of 10 actions, records 30 sequences of 30 frames each.
Supports resume — skips sequences that already have data.

Usage:
    python collect_data.py
    python collect_data.py --actions Hello,Yes
    python collect_data.py --num_sequences 5

Press 'q' to quit at any time.
"""

import argparse
import os
import sys

import cv2
import numpy as np
import mediapipe as mp

from utils import (
    ACTIONS, SEQUENCE_LENGTH, NUM_SEQUENCES, DATA_PATH,
    mediapipe_detection, draw_landmarks, extract_keypoints,
)


def parse_args(argv=None):
    """Parse command-line arguments.

    Args:
        argv: Argument list (defaults to sys.argv[1:]).

    Returns:
        argparse.Namespace with .actions (list[str]), .num_sequences (int).
    """
    parser = argparse.ArgumentParser(description="SenseAI Data Collection")
    parser.add_argument(
        "--actions",
        type=str,
        default=None,
        help="Comma-separated list of sign names to collect (default: all ACTIONS)",
    )
    parser.add_argument(
        "--num_sequences",
        type=int,
        default=NUM_SEQUENCES,
        help=f"Number of sequences to record per action (default: {NUM_SEQUENCES})",
    )
    args = parser.parse_args(argv)

    if args.actions is None:
        args.actions = list(ACTIONS)
    else:
        requested = [a.strip() for a in args.actions.split(",")]
        valid = set(ACTIONS)
        invalid = [a for a in requested if a not in valid]
        if invalid:
            parser.error(f"Invalid action(s): {', '.join(invalid)}. "
                         f"Valid actions: {', '.join(ACTIONS)}")
        args.actions = requested

    return args


def create_directories(actions=None, num_sequences=None):
    """Create MP_Data/{action}/{sequence}/ directory structure."""
    if actions is None:
        actions = ACTIONS
    if num_sequences is None:
        num_sequences = NUM_SEQUENCES
    for action in actions:
        for sequence in range(num_sequences):
            dir_path = os.path.join(DATA_PATH, action, str(sequence))
            os.makedirs(dir_path, exist_ok=True)


def sequence_exists(action, sequence):
    """Check if a sequence has already been recorded (resume support)."""
    return os.path.exists(os.path.join(DATA_PATH, action, str(sequence), '0.npy'))


def main():
    args = parse_args()
    actions = args.actions
    num_sequences = args.num_sequences

    create_directories(actions, num_sequences)

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    mp_holistic = mp.solutions.holistic
    with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:

        for action_idx, action in enumerate(actions):
            for sequence in range(num_sequences):

                if sequence_exists(action, sequence):
                    print(f"  Skipping {action} sequence {sequence} (already recorded)")
                    continue

                for frame_num in range(SEQUENCE_LENGTH):
                    ret, frame = cap.read()
                    if not ret:
                        print("ERROR: Failed to read from webcam")
                        cap.release()
                        cv2.destroyAllWindows()
                        return

                    image, results = mediapipe_detection(frame, holistic)
                    draw_landmarks(image, results)

                    # Status overlay (shown on every frame)
                    cv2.putText(image,
                                f'Sign: {action} | Seq: {sequence} | Frame: {frame_num}',
                                (15, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                                (0, 0, 255), 1, cv2.LINE_AA)

                    if frame_num == 0:
                        # Show "STARTING COLLECTION" message at start of each sequence
                        cv2.putText(image, 'STARTING COLLECTION', (120, 200),
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 4, cv2.LINE_AA)
                        cv2.imshow('SenseAI Data Collection', image)
                        wait_key = cv2.waitKey(500) & 0xFF
                    else:
                        cv2.imshow('SenseAI Data Collection', image)
                        wait_key = cv2.waitKey(10) & 0xFF

                    # Extract and save keypoints
                    keypoints = extract_keypoints(results)
                    npy_path = os.path.join(DATA_PATH, action, str(sequence), str(frame_num))
                    np.save(npy_path, keypoints)

                    # Check for quit
                    if wait_key == ord('q'):
                        print("\nQuitting early...")
                        cap.release()
                        cv2.destroyAllWindows()
                        return

                total_seq = action_idx * num_sequences + sequence + 1
                total_all = len(actions) * num_sequences
                print(f"\u2713 Sequence {sequence + 1}/{num_sequences} recorded for '{action}' "
                      f"({total_seq}/{total_all} total)")

            print(f"\n=== Completed all sequences for '{action}' ===\n")

    cap.release()
    cv2.destroyAllWindows()
    print("\nData collection complete!")


if __name__ == '__main__':
    main()
