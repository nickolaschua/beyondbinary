"""
Tests for ws_server.decode_frame.

Covers:
(a) Valid base64 JPEG → numpy array with 3 channels
(b) Base64 with data URL prefix → works the same
(c) Empty string → returns None
(d) Invalid base64 → returns None
"""

import base64

import cv2
import numpy as np
import pytest

from ws_server import decode_frame


@pytest.fixture
def valid_jpeg_base64():
    """Create a small valid JPEG image encoded as base64."""
    # Create a 10x10 red image
    img = np.zeros((10, 10, 3), dtype=np.uint8)
    img[:, :, 2] = 255  # Red in BGR
    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode('utf-8')


class TestValidInput:
    """(a) Valid base64 JPEG returns numpy array with 3 channels."""

    def test_returns_numpy_array(self, valid_jpeg_base64):
        result = decode_frame(valid_jpeg_base64)
        assert isinstance(result, np.ndarray)

    def test_has_3_channels(self, valid_jpeg_base64):
        result = decode_frame(valid_jpeg_base64)
        assert result.ndim == 3
        assert result.shape[2] == 3

    def test_has_correct_dimensions(self, valid_jpeg_base64):
        result = decode_frame(valid_jpeg_base64)
        assert result.shape[0] == 10  # height
        assert result.shape[1] == 10  # width


class TestDataUrlPrefix:
    """(b) Base64 with data URL prefix works correctly."""

    def test_jpeg_prefix(self, valid_jpeg_base64):
        data_url = f"data:image/jpeg;base64,{valid_jpeg_base64}"
        result = decode_frame(data_url)
        assert isinstance(result, np.ndarray)
        assert result.shape[2] == 3

    def test_png_prefix(self, valid_jpeg_base64):
        # Even with a "png" prefix, the actual data is JPEG — should still decode
        data_url = f"data:image/png;base64,{valid_jpeg_base64}"
        result = decode_frame(data_url)
        assert isinstance(result, np.ndarray)


class TestEmptyString:
    """(c) Empty string returns None."""

    def test_empty_string_returns_none(self):
        result = decode_frame("")
        assert result is None

    def test_whitespace_returns_none(self):
        result = decode_frame("   ")
        assert result is None


class TestInvalidInput:
    """(d) Invalid base64 returns None."""

    def test_not_base64_returns_none(self):
        result = decode_frame("this is not base64!!!")
        assert result is None

    def test_valid_base64_but_not_image_returns_none(self):
        # Valid base64 that doesn't decode to an image
        not_image = base64.b64encode(b"hello world").decode('utf-8')
        result = decode_frame(not_image)
        assert result is None

    def test_data_url_with_empty_payload_returns_none(self):
        result = decode_frame("data:image/jpeg;base64,")
        assert result is None
