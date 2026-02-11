"""
Preprocess MP_Data locally into a compact .npz for fast Colab upload.

Usage:
    python ml/preprocess_for_colab.py

Reads:  ml/MP_Data/  (32,400+ individual .npy frame files)
Writes: ml/training_data.npz  (~15-20 MB, ready for Colab upload)

This strips face landmarks (1662 -> 258 features), normalizes,
and packs everything into one file. Upload training_data.npz to
Colab instead of MP_Data_v2.zip — goes from minutes to seconds.
"""
import os
import sys
import numpy as np

# --- Config ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, 'MP_Data')
OUTPUT_PATH = os.path.join(SCRIPT_DIR, 'training_data.npz')

ACTIONS = [
    'Hello', 'Thank_You', 'Help', 'Yes', 'No',
    'Please', 'Sorry', 'I_Love_You', 'Stop', 'More',
    'How_Are_You', 'Good',
]
SEQUENCE_LENGTH = 30
NUM_FEATURES = 258


def strip_face_features(keypoints):
    """[pose(132), face(1404), lh(63), rh(63)] -> [pose(132), lh(63), rh(63)]"""
    pose = keypoints[:132]
    lh = keypoints[1536:1599]
    rh = keypoints[1599:1662]
    return np.concatenate([pose, lh, rh])


def normalize_frame(frame):
    """Center on nose, scale by shoulder width."""
    pose = frame[:132].reshape(33, 4)
    lh = frame[132:195].reshape(21, 3)
    rh = frame[195:258].reshape(21, 3)

    anchor = pose[0, :3]
    pose[:, :3] -= anchor
    lh -= anchor
    rh -= anchor

    l_shoulder = pose[11, :3]
    r_shoulder = pose[12, :3]
    scale = np.linalg.norm(l_shoulder - r_shoulder)
    if scale > 1e-6:
        pose[:, :3] /= scale
        lh /= scale
        rh /= scale

    return np.concatenate([pose.flatten(), lh.flatten(), rh.flatten()])


def main():
    if not os.path.isdir(DATA_PATH):
        print(f'ERROR: {DATA_PATH} not found.')
        print('Make sure MP_Data/ exists inside ml/')
        sys.exit(1)

    sequences = []
    labels = []
    skipped = 0

    for action_idx, action in enumerate(ACTIONS):
        action_dir = os.path.join(DATA_PATH, action)
        if not os.path.isdir(action_dir):
            print(f'  WARNING: {action_dir} not found, skipping')
            continue

        seq_dirs = sorted(
            [d for d in os.listdir(action_dir)
             if os.path.isdir(os.path.join(action_dir, d)) and d.isdigit()],
            key=int,
        )

        count = 0
        for seq_name in seq_dirs:
            window = []
            valid = True
            for frame_idx in range(SEQUENCE_LENGTH):
                frame_path = os.path.join(action_dir, seq_name, f'{frame_idx}.npy')
                if not os.path.isfile(frame_path):
                    valid = False
                    break
                frame = np.load(frame_path)
                if frame.shape != (1662,):
                    valid = False
                    break
                stripped = strip_face_features(frame)
                normalized = normalize_frame(stripped)
                window.append(normalized)

            if valid and len(window) == SEQUENCE_LENGTH:
                sequences.append(window)
                labels.append(action_idx)
                count += 1
            else:
                skipped += 1

        print(f'  {action}: {count} sequences')

    X = np.array(sequences, dtype=np.float32)
    y = np.array(labels, dtype=np.int32)
    actions = np.array(ACTIONS)

    print(f'\nX shape: {X.shape}  ({X.nbytes / (1024*1024):.1f} MB uncompressed)')
    print(f'y shape: {y.shape}')
    print(f'Skipped: {skipped}')

    np.savez_compressed(OUTPUT_PATH, X=X, y=y, actions=actions)
    file_size = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f'\nSaved: {OUTPUT_PATH} ({file_size:.1f} MB)')
    print('Upload this file to Colab instead of the zip.')


if __name__ == '__main__':
    main()
