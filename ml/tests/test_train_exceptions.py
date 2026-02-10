"""
Tests for specific exception handling in train_model.load_data.

Verifies that load_data catches only (ValueError, OSError, EOFError)
instead of a broad `except Exception`. Covers:
(a) Valid .npy file loads successfully
(b) Truncated/corrupted file (random bytes) is skipped with warning
(c) Wrong-shape file is skipped with warning
(d) The except clause uses specific exceptions, not bare Exception
"""

import ast
import inspect
import os
import textwrap

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


class TestValidFileLoads:
    """(a) Valid .npy file loads successfully — no exceptions raised."""

    def test_valid_data_no_skips(self, tmp_path):
        _create_fake_data(tmp_path, ["Hello"], num_sequences=NUM_SEQUENCES, sequence_length=SEQUENCE_LENGTH)
        X, y, skipped = load_data(str(tmp_path))
        assert skipped == 0
        assert X.shape[0] == NUM_SEQUENCES


class TestCorruptedFile:
    """(b) Truncated/corrupted .npy file is skipped with warning."""

    def test_corrupted_file_skipped(self, tmp_path):
        _create_fake_data(tmp_path, ["Hello"], num_sequences=NUM_SEQUENCES, sequence_length=SEQUENCE_LENGTH)
        # Overwrite frame 0 of sequence 0 with random bytes (not a valid .npy)
        corrupt_path = tmp_path / "Hello" / "0" / "0.npy"
        corrupt_path.write_bytes(b"\x00\xde\xad\xbe\xef" * 10)

        X, y, skipped = load_data(str(tmp_path))
        assert skipped >= 1  # At least sequence 0 was skipped
        assert X.shape[0] == NUM_SEQUENCES - 1


class TestWrongShapeFile:
    """(c) File with wrong shape is skipped with warning."""

    def test_wrong_shape_skipped(self, tmp_path):
        _create_fake_data(tmp_path, ["Hello"], num_sequences=NUM_SEQUENCES, sequence_length=SEQUENCE_LENGTH)
        # Overwrite frame 0 of sequence 0 with wrong shape
        bad_frame = np.zeros((100,))
        np.save(tmp_path / "Hello" / "0" / "0.npy", bad_frame)

        X, y, skipped = load_data(str(tmp_path))
        assert skipped >= 1
        assert X.shape[0] == NUM_SEQUENCES - 1


class TestSpecificExceptions:
    """(d) The except clause catches specific exceptions, not bare Exception."""

    def test_except_clause_is_specific(self):
        """Parse the source of load_data and verify the except clause
        catches (ValueError, OSError, EOFError) — not bare Exception."""
        source = inspect.getsource(load_data)
        # Dedent so ast.parse works on the function body
        source = textwrap.dedent(source)
        tree = ast.parse(source)

        # Walk the AST looking for ExceptHandler nodes
        found_handlers = []
        for node in ast.walk(tree):
            if isinstance(node, ast.ExceptHandler):
                found_handlers.append(node)

        assert len(found_handlers) > 0, "No except handlers found in load_data"

        for handler in found_handlers:
            exc_type = handler.type
            # It should be a tuple of specific exceptions, not a single Name("Exception")
            if isinstance(exc_type, ast.Name):
                assert exc_type.id != "Exception", (
                    f"load_data uses bare 'except Exception' — "
                    f"should catch (ValueError, OSError, EOFError)"
                )

            # If it's a Tuple, verify the names inside
            if isinstance(exc_type, ast.Tuple):
                names = {elt.id for elt in exc_type.elts if isinstance(elt, ast.Name)}
                expected = {"ValueError", "OSError", "EOFError"}
                assert names == expected, (
                    f"Expected except clause to catch {expected}, got {names}"
                )
