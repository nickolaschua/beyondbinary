"""
Tests for train_model.load_data using tmp_path fixture.

Covers:
(a) Valid data loads correctly
(b) Missing action directory logs warning and continues
(c) Missing frame .npy in a sequence skips that sequence
(d) .npy with wrong shape skips that sequence
"""

import numpy as np
import pytest

from train_model import load_data, ACTIONS, SEQUENCE_LENGTH, NUM_FEATURES, NUM_SEQUENCES


def _create_fake_data(base_path, actions, num_sequences, sequence_length, num_features=1662):
    """Create fake MP_Data directory structure with valid .npy files."""
    for action in actions:
        for seq_idx in range(num_sequences):
            seq_dir = base_path / action / str(seq_idx)
            seq_dir.mkdir(parents=True, exist_ok=True)
            for frame_idx in range(sequence_length):
                frame = np.random.rand(num_features).astype(np.float32)
                np.save(seq_dir / f"{frame_idx}.npy", frame)


class TestValidData:
    """(a) Valid data loads correctly."""

    def test_loads_correct_number_of_sequences(self, tmp_path):
        # Create all NUM_SEQUENCES for one action to avoid skipped-sequence noise
        _create_fake_data(tmp_path, ["Hello"], num_sequences=NUM_SEQUENCES, sequence_length=SEQUENCE_LENGTH)
        X, y, skipped = load_data(str(tmp_path))
        assert X.shape[0] == NUM_SEQUENCES
        assert skipped == 0

    def test_X_shape(self, tmp_path):
        _create_fake_data(tmp_path, ["Hello"], num_sequences=NUM_SEQUENCES, sequence_length=SEQUENCE_LENGTH)
        X, y, skipped = load_data(str(tmp_path))
        assert X.shape == (NUM_SEQUENCES, SEQUENCE_LENGTH, NUM_FEATURES)

    def test_y_shape(self, tmp_path):
        _create_fake_data(tmp_path, ["Hello"], num_sequences=NUM_SEQUENCES, sequence_length=SEQUENCE_LENGTH)
        X, y, skipped = load_data(str(tmp_path))
        assert y.shape == (NUM_SEQUENCES, len(ACTIONS))

    def test_y_is_one_hot(self, tmp_path):
        _create_fake_data(tmp_path, ["Hello"], num_sequences=NUM_SEQUENCES, sequence_length=SEQUENCE_LENGTH)
        X, y, skipped = load_data(str(tmp_path))
        # Each row should sum to 1.0 (one-hot)
        for row in y:
            assert np.isclose(np.sum(row), 1.0)


class TestMissingActionDirectory:
    """(b) Missing action directory logs warning and continues."""

    def test_continues_with_available_actions(self, tmp_path):
        # Only create "Hello" — other 9 actions are missing directories
        _create_fake_data(tmp_path, ["Hello"], num_sequences=NUM_SEQUENCES, sequence_length=SEQUENCE_LENGTH)
        X, y, skipped = load_data(str(tmp_path))
        assert X.shape[0] == NUM_SEQUENCES  # Only Hello's sequences loaded


class TestMissingFrame:
    """(c) Missing frame .npy in a sequence skips that sequence."""

    def test_skips_sequence_with_missing_frame(self, tmp_path):
        # Create all sequences of "Hello", then delete frame 15 from sequence 1
        _create_fake_data(tmp_path, ["Hello"], num_sequences=NUM_SEQUENCES, sequence_length=SEQUENCE_LENGTH)
        missing_frame = tmp_path / "Hello" / "1" / "15.npy"
        missing_frame.unlink()

        X, y, skipped = load_data(str(tmp_path))
        assert X.shape[0] == NUM_SEQUENCES - 1  # Sequence 1 skipped
        assert skipped == 1


class TestWrongShape:
    """(d) .npy with wrong shape skips that sequence."""

    def test_skips_sequence_with_wrong_shape(self, tmp_path):
        _create_fake_data(tmp_path, ["Hello"], num_sequences=NUM_SEQUENCES, sequence_length=SEQUENCE_LENGTH)
        # Overwrite frame 0 of sequence 1 with wrong shape
        bad_frame = np.zeros((100,))  # Wrong shape (should be 1662)
        np.save(tmp_path / "Hello" / "1" / "0.npy", bad_frame)

        X, y, skipped = load_data(str(tmp_path))
        assert X.shape[0] == NUM_SEQUENCES - 1  # Sequence 1 skipped
        assert skipped == 1
