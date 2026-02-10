"""
Tests for type annotations on public functions in utils.py.

Covers:
(a) extract_keypoints has a return annotation
(b) mediapipe_detection has parameter annotations
(c) StabilityFilter.update has both parameter and return annotations
"""

import inspect

from utils import extract_keypoints, mediapipe_detection, StabilityFilter


class TestTypeAnnotations:
    """Verify public functions have type annotations."""

    def test_extract_keypoints_has_return_annotation(self):
        """(a) extract_keypoints should have a return type annotation."""
        sig = inspect.signature(extract_keypoints)
        assert sig.return_annotation is not inspect.Parameter.empty, (
            "extract_keypoints is missing a return type annotation"
        )

    def test_mediapipe_detection_has_parameter_annotations(self):
        """(b) mediapipe_detection should have parameter type annotations."""
        sig = inspect.signature(mediapipe_detection)
        for name, param in sig.parameters.items():
            assert param.annotation is not inspect.Parameter.empty, (
                f"mediapipe_detection parameter '{name}' is missing a type annotation"
            )

    def test_stability_filter_update_has_annotations(self):
        """(c) StabilityFilter.update should have both parameter and return annotations."""
        sig = inspect.signature(StabilityFilter.update)
        # Check return annotation
        assert sig.return_annotation is not inspect.Parameter.empty, (
            "StabilityFilter.update is missing a return type annotation"
        )
        # Check parameter annotations (skip 'self')
        for name, param in sig.parameters.items():
            if name == "self":
                continue
            assert param.annotation is not inspect.Parameter.empty, (
                f"StabilityFilter.update parameter '{name}' is missing a type annotation"
            )
