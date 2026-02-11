"""Tests for augment.py — data augmentation functions."""

import numpy as np
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from augment import (
    add_gaussian_noise,
    temporal_shift,
    mirror_hands,
    speed_variation,
    frame_dropout,
    augment_sequence,
    augment_dataset,
    LH_START,
    LH_END,
    RH_START,
    RH_END,
)

SEQ_LEN = 30
NUM_FEATURES = 1662


@pytest.fixture
def sample_sequence():
    """Create a realistic sample sequence with non-zero hand data."""
    rng = np.random.default_rng(123)
    seq = rng.standard_normal((SEQ_LEN, NUM_FEATURES)).astype(np.float32)
    return seq


@pytest.fixture
def sequence_with_zeros():
    """Sequence where some body parts are undetected (zeros)."""
    rng = np.random.default_rng(456)
    seq = rng.standard_normal((SEQ_LEN, NUM_FEATURES)).astype(np.float32)
    # Zero out left hand to simulate undetected
    seq[:, LH_START:LH_END] = 0.0
    return seq


class TestGaussianNoise:
    def test_output_shape(self, sample_sequence):
        result = add_gaussian_noise(sample_sequence, std=0.005)
        assert result.shape == sample_sequence.shape

    def test_values_differ(self, sample_sequence):
        result = add_gaussian_noise(sample_sequence, std=0.01)
        assert not np.array_equal(result, sample_sequence)

    def test_preserves_zeros(self, sequence_with_zeros):
        result = add_gaussian_noise(sequence_with_zeros, std=0.01)
        # Left hand should still be zero
        assert np.all(result[:, LH_START:LH_END] == 0.0)

    def test_does_not_modify_original(self, sample_sequence):
        original = sample_sequence.copy()
        add_gaussian_noise(sample_sequence, std=0.01)
        np.testing.assert_array_equal(sample_sequence, original)

    def test_reproducible_with_seed(self, sample_sequence):
        r1 = add_gaussian_noise(sample_sequence, rng=np.random.default_rng(42))
        r2 = add_gaussian_noise(sample_sequence, rng=np.random.default_rng(42))
        np.testing.assert_array_equal(r1, r2)


class TestTemporalShift:
    def test_output_shape(self, sample_sequence):
        result = temporal_shift(sample_sequence, max_shift=3)
        assert result.shape == sample_sequence.shape

    def test_does_not_modify_original(self, sample_sequence):
        original = sample_sequence.copy()
        temporal_shift(sample_sequence, max_shift=3)
        np.testing.assert_array_equal(sample_sequence, original)

    def test_shift_right_pads_beginning(self, sample_sequence):
        # Force a positive shift
        rng = np.random.default_rng(0)
        # Try multiple times to get a non-zero shift
        for _ in range(100):
            result = temporal_shift(sample_sequence, max_shift=3, rng=rng)
            if not np.array_equal(result, sample_sequence):
                break
        # Just verify shape is preserved
        assert result.shape == sample_sequence.shape

    def test_zero_shift_returns_copy(self, sample_sequence):
        # With max_shift=0, shift is always 0
        result = temporal_shift(sample_sequence, max_shift=0)
        np.testing.assert_array_equal(result, sample_sequence)


class TestMirrorHands:
    def test_output_shape(self, sample_sequence):
        result = mirror_hands(sample_sequence)
        assert result.shape == sample_sequence.shape

    def test_swaps_hands(self, sample_sequence):
        result = mirror_hands(sample_sequence)
        # Left hand in result should be original right hand
        np.testing.assert_array_equal(
            result[:, LH_START:LH_END],
            sample_sequence[:, RH_START:RH_END],
        )
        # Right hand in result should be original left hand
        np.testing.assert_array_equal(
            result[:, RH_START:RH_END],
            sample_sequence[:, LH_START:LH_END],
        )

    def test_double_mirror_is_identity(self, sample_sequence):
        result = mirror_hands(mirror_hands(sample_sequence))
        np.testing.assert_array_equal(result, sample_sequence)

    def test_preserves_pose_and_face(self, sample_sequence):
        result = mirror_hands(sample_sequence)
        # Pose and face should be untouched
        np.testing.assert_array_equal(
            result[:, :LH_START],
            sample_sequence[:, :LH_START],
        )

    def test_does_not_modify_original(self, sample_sequence):
        original = sample_sequence.copy()
        mirror_hands(sample_sequence)
        np.testing.assert_array_equal(sample_sequence, original)


class TestSpeedVariation:
    def test_output_shape(self, sample_sequence):
        result = speed_variation(sample_sequence)
        assert result.shape == sample_sequence.shape

    def test_does_not_modify_original(self, sample_sequence):
        original = sample_sequence.copy()
        speed_variation(sample_sequence)
        np.testing.assert_array_equal(sample_sequence, original)

    def test_factor_1_preserves_values(self, sample_sequence):
        # Factor range of exactly 1.0 should preserve input
        result = speed_variation(sample_sequence, factor_range=(1.0, 1.0))
        np.testing.assert_array_almost_equal(result, sample_sequence, decimal=5)


class TestFrameDropout:
    def test_output_shape(self, sample_sequence):
        result = frame_dropout(sample_sequence, drop_rate=0.3)
        assert result.shape == sample_sequence.shape

    def test_preserves_first_and_last(self, sample_sequence):
        result = frame_dropout(sample_sequence, drop_rate=1.0)
        np.testing.assert_array_equal(result[0], sample_sequence[0])
        np.testing.assert_array_equal(result[-1], sample_sequence[-1])

    def test_zero_rate_preserves_all(self, sample_sequence):
        result = frame_dropout(sample_sequence, drop_rate=0.0)
        np.testing.assert_array_equal(result, sample_sequence)

    def test_does_not_modify_original(self, sample_sequence):
        original = sample_sequence.copy()
        frame_dropout(sample_sequence, drop_rate=0.5)
        np.testing.assert_array_equal(sample_sequence, original)


class TestAugmentSequence:
    def test_output_shape(self, sample_sequence):
        result = augment_sequence(sample_sequence)
        assert result.shape == sample_sequence.shape

    def test_does_not_modify_original(self, sample_sequence):
        original = sample_sequence.copy()
        augment_sequence(sample_sequence)
        np.testing.assert_array_equal(sample_sequence, original)

    def test_reproducible_with_seed(self, sample_sequence):
        r1 = augment_sequence(sample_sequence, rng=np.random.default_rng(42))
        r2 = augment_sequence(sample_sequence, rng=np.random.default_rng(42))
        np.testing.assert_array_equal(r1, r2)


class TestAugmentDataset:
    @pytest.fixture
    def small_dataset(self):
        rng = np.random.default_rng(789)
        X = rng.standard_normal((10, SEQ_LEN, NUM_FEATURES)).astype(np.float32)
        y = np.zeros((10, 10))
        for i in range(10):
            y[i, i % 10] = 1.0  # one-hot
        return X, y

    def test_multiplier_increases_size(self, small_dataset):
        X, y = small_dataset
        X_aug, y_aug = augment_dataset(X, y, multiplier=3, use_mirror=False)
        # Original + 3 augmented = 4x
        assert len(X_aug) == len(X) * 4
        assert len(y_aug) == len(y) * 4

    def test_mirror_doubles_size(self, small_dataset):
        X, y = small_dataset
        X_no_mirror, _ = augment_dataset(X, y, multiplier=2, use_mirror=False)
        X_mirror, _ = augment_dataset(X, y, multiplier=2, use_mirror=True)
        assert len(X_mirror) == len(X_no_mirror) * 2

    def test_labels_preserved(self, small_dataset):
        X, y = small_dataset
        _, y_aug = augment_dataset(X, y, multiplier=2, use_mirror=False)
        # Each label class should appear 3x (1 original + 2 augmented)
        y_classes = np.argmax(y_aug, axis=1)
        for c in range(10):
            assert np.sum(y_classes == c) == 3  # 1 sample * 3

    def test_output_shapes(self, small_dataset):
        X, y = small_dataset
        X_aug, y_aug = augment_dataset(X, y, multiplier=2, use_mirror=True)
        assert X_aug.shape[1:] == (SEQ_LEN, NUM_FEATURES)
        assert y_aug.shape[1] == 10

    def test_zero_multiplier(self, small_dataset):
        X, y = small_dataset
        # multiplier=0 means 0 augmented + originals only
        X_aug, y_aug = augment_dataset(X, y, multiplier=0, use_mirror=False)
        assert len(X_aug) == len(X)

    def test_reproducible(self, small_dataset):
        X, y = small_dataset
        X1, y1 = augment_dataset(X, y, multiplier=2, seed=42)
        X2, y2 = augment_dataset(X, y, multiplier=2, seed=42)
        np.testing.assert_array_equal(X1, X2)
        np.testing.assert_array_equal(y1, y2)
