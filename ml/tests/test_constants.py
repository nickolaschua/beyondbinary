"""
Tests that constants are consistent across all ML pipeline modules.

Verifies ACTIONS, NUM_SEQUENCES, and SEQUENCE_LENGTH are identical
in utils.py, train_model.py, and verify_data.py.
"""

import numpy as np

from utils import ACTIONS as UTILS_ACTIONS
from utils import NUM_SEQUENCES as UTILS_NUM_SEQUENCES
from utils import SEQUENCE_LENGTH as UTILS_SEQUENCE_LENGTH
from train_model import ACTIONS as TRAIN_ACTIONS
from train_model import NUM_SEQUENCES as TRAIN_NUM_SEQUENCES
from train_model import SEQUENCE_LENGTH as TRAIN_SEQUENCE_LENGTH
import verify_data


class TestActionsConsistency:
    """ACTIONS must be identical across all modules."""

    def test_train_model_actions_match_utils(self):
        assert list(TRAIN_ACTIONS) == list(UTILS_ACTIONS)

    def test_verify_data_actions_match_utils(self):
        assert list(verify_data.ACTIONS) == list(UTILS_ACTIONS)

    def test_actions_length(self):
        assert len(UTILS_ACTIONS) == 12


class TestNumSequencesConsistency:
    """NUM_SEQUENCES must be identical across all modules."""

    def test_train_model_num_sequences_match_utils(self):
        assert TRAIN_NUM_SEQUENCES == UTILS_NUM_SEQUENCES

    def test_verify_data_num_sequences_match_utils(self):
        assert verify_data.NUM_SEQUENCES == UTILS_NUM_SEQUENCES


class TestSequenceLengthConsistency:
    """SEQUENCE_LENGTH must be identical across all modules."""

    def test_train_model_sequence_length_match_utils(self):
        assert TRAIN_SEQUENCE_LENGTH == UTILS_SEQUENCE_LENGTH
