"""
SenseAI Data Verification Script

Checks recorded data quality BEFORE training. For each sign:
- Counts sequences in the directory
- Verifies keypoint shape is (1662,)
- Checks hand detection rates by inspecting landmark indices

Usage:
    python verify_data.py

Exit codes:
    0 - All signs pass verification
    1 - Critical failure: any sign has <15/30 hands detected
"""

import os
import sys
import numpy as np

# Constants (duplicated here to keep verify_data.py standalone)
ACTIONS = ['Hello', 'Thank_You', 'Help', 'Yes', 'No',
           'Please', 'Sorry', 'I_Love_You', 'Stop', 'More']
DATA_PATH = 'MP_Data'
NUM_SEQUENCES = 30
EXPECTED_SHAPE = (1662,)

# Keypoint index ranges for hand landmarks
# Keypoint order: [pose(33*4=132), face(468*3=1404), lh(21*3=63), rh(21*3=63)]
# Total: 132 + 1404 + 63 + 63 = 1662
LH_START = 1536  # 132 + 1404
LH_END = 1599    # 1536 + 63
RH_START = 1599
RH_END = 1662


def check_hands_detected(keypoints):
    """Check if either left or right hand landmarks are non-zero."""
    lh = keypoints[LH_START:LH_END]
    rh = keypoints[RH_START:RH_END]
    return np.any(lh != 0) or np.any(rh != 0)


def main():
    print("=" * 70)
    print("SenseAI Data Verification")
    print("=" * 70)
    print(f"\nExpected keypoint shape: {EXPECTED_SHAPE}")
    print(f"Expected sequences per sign: {NUM_SEQUENCES}")
    print(f"Checking middle frame (frame 15) for hand detection\n")
    print("-" * 75)

    critical_failure = False
    warnings = []

    for action in ACTIONS:
        action_dir = os.path.join(DATA_PATH, action)

        if not os.path.exists(action_dir):
            print(f"{action:15s} |  0 sequences | shape: N/A    | DIRECTORY NOT FOUND")
            critical_failure = True
            continue

        # Count sequences
        sequences = [d for d in os.listdir(action_dir)
                     if os.path.isdir(os.path.join(action_dir, d))]
        num_sequences = len(sequences)

        # Check sample frame shape
        sample_path = os.path.join(action_dir, '0', '0.npy')
        if os.path.exists(sample_path):
            sample = np.load(sample_path)
            shape = sample.shape
            if shape != EXPECTED_SHAPE:
                print(f"{action:15s} | {num_sequences:2d} sequences | shape: {shape} | SHAPE MISMATCH (expected {EXPECTED_SHAPE})")
                critical_failure = True
                continue
        else:
            print(f"{action:15s} | {num_sequences:2d} sequences | shape: NO DATA | NO DATA TO CHECK")
            critical_failure = True
            continue

        # Check hand detection on middle frame of each sequence
        hands_count = 0
        for seq in range(num_sequences):
            frame_path = os.path.join(action_dir, str(seq), '15.npy')
            if os.path.exists(frame_path):
                keypoints = np.load(frame_path)
                if check_hands_detected(keypoints):
                    hands_count += 1

        print(f"{action:15s} | {num_sequences:2d} sequences | shape: {shape} | hands detected: {hands_count}/{num_sequences}")

        # Check thresholds
        if hands_count < 15:
            critical_failure = True
            warnings.append(f"CRITICAL: '{action}' has only {hands_count}/{num_sequences} "
                            f"hands detected — re-record immediately")
        elif hands_count < 20:
            warnings.append(f"WARNING: '{action}' has only {hands_count}/{num_sequences} "
                            f"hands detected — re-record with better lighting/positioning")

    print("-" * 75)

    if warnings:
        print()
        for w in warnings:
            print(f"  ! {w}")

    if critical_failure:
        print("\nVERIFICATION FAILED — fix issues above before training")
        sys.exit(1)
    else:
        print("\nAll signs pass verification. Ready for training.")
        sys.exit(0)


if __name__ == '__main__':
    main()
