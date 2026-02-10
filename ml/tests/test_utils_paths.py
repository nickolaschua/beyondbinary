"""
Tests for path resolution in utils.py.

Covers:
(a) DATA_PATH is an absolute path
(b) DATA_PATH ends with 'MP_Data'
(c) MODEL_PATH is an absolute path
(d) Both paths share the same parent directory
"""

import os

from utils import DATA_PATH, MODEL_PATH


class TestPathResolution:
    """Verify DATA_PATH and MODEL_PATH resolve correctly."""

    def test_data_path_is_absolute(self):
        """(a) DATA_PATH should be an absolute path."""
        assert os.path.isabs(DATA_PATH), f"DATA_PATH is not absolute: {DATA_PATH}"

    def test_data_path_ends_with_mp_data(self):
        """(b) DATA_PATH should end with 'MP_Data'."""
        assert os.path.basename(DATA_PATH) == "MP_Data", (
            f"DATA_PATH does not end with 'MP_Data': {DATA_PATH}"
        )

    def test_model_path_is_absolute(self):
        """(c) MODEL_PATH should be an absolute path."""
        assert os.path.isabs(MODEL_PATH), f"MODEL_PATH is not absolute: {MODEL_PATH}"

    def test_paths_share_parent_directory(self):
        """(d) DATA_PATH and MODEL_PATH share the same parent (ml/) directory."""
        data_parent = os.path.dirname(DATA_PATH)
        # MODEL_PATH is ml/models/action_model.h5, so parent of parent is ml/
        model_grandparent = os.path.dirname(os.path.dirname(MODEL_PATH))
        assert data_parent == model_grandparent, (
            f"DATA_PATH parent ({data_parent}) != MODEL_PATH grandparent ({model_grandparent})"
        )
