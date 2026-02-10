"""
SenseAI — Data Augmentation for Sign Language Keypoint Sequences

Provides augmentation strategies to improve model accuracy when training
on limited webcam data. Each function takes a sequence of shape
(SEQUENCE_LENGTH, 1662) and returns an augmented copy.

Augmentations:
    - Gaussian noise:  Simulates tracking jitter
    - Temporal shift:  Shifts the frame window forward/backward
    - Mirror (L/R swap): Swaps left and right hand keypoints
    - Speed variation: Interpolates to simulate faster/slower signing
    - Frame dropout:   Randomly zeros out frames for robustness

Usage:
    from augment import augment_dataset
    X_aug, y_aug = augment_dataset(X_train, y_train, multiplier=5)
"""

import numpy as np
from typing import Optional

# Keypoint index ranges (must match utils.py extract_keypoints order)
# [pose(33*4=132), face(468*3=1404), lh(21*3=63), rh(21*3=63)]
POSE_END = 132
FACE_END = 132 + 1404  # 1536
LH_START = 1536
LH_END = 1536 + 63     # 1599
RH_START = 1599
RH_END = 1599 + 63     # 1662


def add_gaussian_noise(sequence: np.ndarray, std: float = 0.005,
                       rng: Optional[np.random.Generator] = None) -> np.ndarray:
    """Add Gaussian noise to keypoint values.

    Only adds noise to non-zero values (preserves zero-padding for
    undetected body parts).

    Args:
        sequence: Shape (seq_len, 1662).
        std: Standard deviation of noise. 0.005 is subtle; 0.01 is moderate.
        rng: Optional numpy random generator for reproducibility.

    Returns:
        Augmented copy of shape (seq_len, 1662).
    """
    if rng is None:
        rng = np.random.default_rng()

    aug = sequence.copy()
    noise = rng.normal(0, std, size=aug.shape).astype(aug.dtype)
    # Only add noise where original values are non-zero
    mask = aug != 0
    aug[mask] += noise[mask]
    return aug


def temporal_shift(sequence: np.ndarray, max_shift: int = 3,
                   rng: Optional[np.random.Generator] = None) -> np.ndarray:
    """Shift the frame window forward or backward, padding with edge frames.

    Args:
        sequence: Shape (seq_len, 1662).
        max_shift: Maximum number of frames to shift in either direction.
        rng: Optional numpy random generator.

    Returns:
        Augmented copy of shape (seq_len, 1662).
    """
    if rng is None:
        rng = np.random.default_rng()

    shift = rng.integers(-max_shift, max_shift + 1)
    if shift == 0:
        return sequence.copy()

    aug = np.zeros_like(sequence)
    seq_len = len(sequence)

    if shift > 0:
        # Shift right: pad beginning with first frame
        aug[:shift] = sequence[0]
        aug[shift:] = sequence[:seq_len - shift]
    else:
        # Shift left: pad end with last frame
        abs_shift = abs(shift)
        aug[:seq_len - abs_shift] = sequence[abs_shift:]
        aug[seq_len - abs_shift:] = sequence[-1]

    return aug


def mirror_hands(sequence: np.ndarray) -> np.ndarray:
    """Swap left and right hand keypoints to simulate mirrored signing.

    This effectively doubles the data by creating a "mirror" version.
    Only swaps the hand landmark sections; pose and face remain unchanged.

    Args:
        sequence: Shape (seq_len, 1662).

    Returns:
        Augmented copy with L/R hands swapped, shape (seq_len, 1662).
    """
    aug = sequence.copy()
    lh = aug[:, LH_START:LH_END].copy()
    rh = aug[:, RH_START:RH_END].copy()
    aug[:, LH_START:LH_END] = rh
    aug[:, RH_START:RH_END] = lh
    return aug


def speed_variation(sequence: np.ndarray, factor_range: tuple = (0.8, 1.2),
                    rng: Optional[np.random.Generator] = None) -> np.ndarray:
    """Simulate faster or slower signing by interpolating frames.

    A factor < 1.0 speeds up (fewer unique frames, padded),
    a factor > 1.0 slows down (subsampled from a longer window).

    Args:
        sequence: Shape (seq_len, 1662).
        factor_range: (min_factor, max_factor) for random speed change.
        rng: Optional numpy random generator.

    Returns:
        Augmented copy of shape (seq_len, 1662), same length as input.
    """
    if rng is None:
        rng = np.random.default_rng()

    seq_len = len(sequence)
    factor = rng.uniform(*factor_range)

    # Create new indices by stretching/compressing the timeline
    new_len = int(seq_len * factor)
    if new_len < 2:
        new_len = 2

    # Generate interpolated indices back to original length
    original_indices = np.linspace(0, seq_len - 1, new_len)
    target_indices = np.linspace(0, new_len - 1, seq_len)

    # Map target indices back to original frame indices
    mapped = np.interp(target_indices, np.arange(new_len), original_indices)

    # Interpolate each feature dimension
    aug = np.zeros_like(sequence)
    for i in range(sequence.shape[1]):
        aug[:, i] = np.interp(mapped, np.arange(seq_len), sequence[:, i])

    return aug


def frame_dropout(sequence: np.ndarray, drop_rate: float = 0.1,
                  rng: Optional[np.random.Generator] = None) -> np.ndarray:
    """Randomly replace frames with the previous frame (simulates dropped frames).

    Never drops the first or last frame. Dropped frames are replaced with
    the preceding frame rather than zeros, which is more realistic.

    Args:
        sequence: Shape (seq_len, 1662).
        drop_rate: Probability of dropping each frame (0.0 to 0.3 recommended).
        rng: Optional numpy random generator.

    Returns:
        Augmented copy of shape (seq_len, 1662).
    """
    if rng is None:
        rng = np.random.default_rng()

    aug = sequence.copy()
    seq_len = len(aug)

    for i in range(1, seq_len - 1):
        if rng.random() < drop_rate:
            aug[i] = aug[i - 1]

    return aug


def augment_sequence(sequence: np.ndarray,
                     rng: Optional[np.random.Generator] = None) -> np.ndarray:
    """Apply a random combination of augmentations to a single sequence.

    Applies augmentations with independent probabilities:
        - Gaussian noise:   80% chance (very common tracking jitter)
        - Temporal shift:   50% chance
        - Speed variation:  40% chance
        - Frame dropout:    30% chance

    Mirror is handled separately in augment_dataset since it changes
    the semantic meaning for some signs.

    Args:
        sequence: Shape (seq_len, 1662).
        rng: Optional numpy random generator.

    Returns:
        Augmented copy of shape (seq_len, 1662).
    """
    if rng is None:
        rng = np.random.default_rng()

    aug = sequence.copy()

    if rng.random() < 0.8:
        std = rng.uniform(0.002, 0.008)
        aug = add_gaussian_noise(aug, std=std, rng=rng)

    if rng.random() < 0.5:
        aug = temporal_shift(aug, max_shift=3, rng=rng)

    if rng.random() < 0.4:
        aug = speed_variation(aug, factor_range=(0.85, 1.15), rng=rng)

    if rng.random() < 0.3:
        aug = frame_dropout(aug, drop_rate=0.1, rng=rng)

    return aug


def augment_dataset(X: np.ndarray, y: np.ndarray,
                    multiplier: int = 5,
                    use_mirror: bool = True,
                    seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Augment an entire dataset to improve model generalization.

    For each original sequence, generates `multiplier` augmented versions.
    Optionally adds mirrored (L/R hand swap) versions as well.

    Args:
        X: Training data of shape (N, seq_len, 1662).
        y: Labels of shape (N, num_classes) — one-hot encoded.
        multiplier: Number of augmented copies per original sample.
            With 30 sequences/sign and multiplier=5, you get 180 per sign.
        use_mirror: If True, also add L/R mirrored versions (further 2x).
        seed: Random seed for reproducibility.

    Returns:
        (X_aug, y_aug): Augmented arrays including originals.
            X_aug shape: (N * (1 + multiplier) [* 2 if mirror], seq_len, 1662)
            y_aug shape: matching labels
    """
    rng = np.random.default_rng(seed)

    all_X = [X]  # Start with originals
    all_y = [y]

    # Generate augmented copies
    for _ in range(multiplier):
        batch = np.array([augment_sequence(seq, rng=rng) for seq in X])
        all_X.append(batch)
        all_y.append(y)

    # Optionally add mirrored versions
    if use_mirror:
        combined_X = np.concatenate(all_X, axis=0)
        combined_y = np.concatenate(all_y, axis=0)

        mirrored_X = np.array([mirror_hands(seq) for seq in combined_X])
        all_X = [combined_X, mirrored_X]
        all_y = [combined_y, combined_y]

    X_aug = np.concatenate(all_X, axis=0)
    y_aug = np.concatenate(all_y, axis=0)

    # Shuffle
    indices = rng.permutation(len(X_aug))
    X_aug = X_aug[indices]
    y_aug = y_aug[indices]

    return X_aug, y_aug
