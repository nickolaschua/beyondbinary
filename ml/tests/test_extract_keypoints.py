"""
Tests for extract_keypoints edge cases.

Covers:
(a) All landmarks present → correct shape and non-zero values in all sections
(b) No landmarks detected → shape (1662,) all zeros
(c) Only hands detected → pose/face sections are zeros, hand sections are non-zero
"""

import numpy as np

from utils import extract_keypoints


# Section boundaries in the 1662-dim keypoint vector
POSE_START = 0
POSE_END = 132          # 33 * 4
FACE_START = 132
FACE_END = 1536         # 132 + 468 * 3
LH_START = 1536
LH_END = 1599           # 1536 + 21 * 3
RH_START = 1599
RH_END = 1662           # 1599 + 21 * 3


class TestAllLandmarksPresent:
    """(a) All landmarks present → correct shape and non-zero values."""

    def test_shape_is_1662(self, mock_results_all):
        keypoints = extract_keypoints(mock_results_all)
        assert keypoints.shape == (1662,)

    def test_pose_section_nonzero(self, mock_results_all):
        keypoints = extract_keypoints(mock_results_all)
        pose = keypoints[POSE_START:POSE_END]
        assert np.any(pose != 0), "Pose section should have non-zero values"

    def test_face_section_nonzero(self, mock_results_all):
        keypoints = extract_keypoints(mock_results_all)
        face = keypoints[FACE_START:FACE_END]
        assert np.any(face != 0), "Face section should have non-zero values"

    def test_left_hand_section_nonzero(self, mock_results_all):
        keypoints = extract_keypoints(mock_results_all)
        lh = keypoints[LH_START:LH_END]
        assert np.any(lh != 0), "Left hand section should have non-zero values"

    def test_right_hand_section_nonzero(self, mock_results_all):
        keypoints = extract_keypoints(mock_results_all)
        rh = keypoints[RH_START:RH_END]
        assert np.any(rh != 0), "Right hand section should have non-zero values"


class TestNoLandmarksDetected:
    """(b) No landmarks detected → shape (1662,) all zeros."""

    def test_shape_is_1662(self, mock_results_none):
        keypoints = extract_keypoints(mock_results_none)
        assert keypoints.shape == (1662,)

    def test_all_zeros(self, mock_results_none):
        keypoints = extract_keypoints(mock_results_none)
        assert np.all(keypoints == 0), "All values should be zero when nothing detected"


class TestHandsOnly:
    """(c) Only hands detected → pose/face zeros, hand sections non-zero."""

    def test_shape_is_1662(self, mock_results_hands_only):
        keypoints = extract_keypoints(mock_results_hands_only)
        assert keypoints.shape == (1662,)

    def test_pose_section_zeros(self, mock_results_hands_only):
        keypoints = extract_keypoints(mock_results_hands_only)
        pose = keypoints[POSE_START:POSE_END]
        assert np.all(pose == 0), "Pose section should be all zeros"

    def test_face_section_zeros(self, mock_results_hands_only):
        keypoints = extract_keypoints(mock_results_hands_only)
        face = keypoints[FACE_START:FACE_END]
        assert np.all(face == 0), "Face section should be all zeros"

    def test_left_hand_nonzero(self, mock_results_hands_only):
        keypoints = extract_keypoints(mock_results_hands_only)
        lh = keypoints[LH_START:LH_END]
        assert np.any(lh != 0), "Left hand section should have non-zero values"

    def test_right_hand_nonzero(self, mock_results_hands_only):
        keypoints = extract_keypoints(mock_results_hands_only)
        rh = keypoints[RH_START:RH_END]
        assert np.any(rh != 0), "Right hand section should have non-zero values"
