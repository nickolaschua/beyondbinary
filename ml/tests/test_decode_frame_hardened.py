"""
Tests for hardened decode_frame in ws_server.

Covers:
(a) Invalid base64 → returns None (uses specific binascii.Error/ValueError catch)
(b) Valid base64 non-image → returns None
(c) "data:image/jpeg;base64" with no comma → returns None
(d) String >5MB → returns None
(e) Normal input still works
"""

import base64

import cv2
import numpy as np
import pytest

from ws_server import decode_frame


@pytest.fixture
def valid_jpeg_base64():
    """Create a small valid JPEG image encoded as base64."""
    img = np.zeros((10, 10, 3), dtype=np.uint8)
    img[:, :, 2] = 255  # Red in BGR
    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode('utf-8')


class TestInvalidBase64:
    """(a) Invalid base64 → returns None."""

    def test_garbage_string_returns_none(self):
        result = decode_frame("!!!not-base64!!!")
        assert result is None

    def test_partial_base64_returns_none(self):
        result = decode_frame("YWJj===")  # bad padding
        assert result is None


class TestValidBase64NonImage:
    """(b) Valid base64 that is not an image → returns None."""

    def test_base64_text_returns_none(self):
        data = base64.b64encode(b"this is plain text, not an image").decode()
        result = decode_frame(data)
        assert result is None

    def test_base64_random_bytes_returns_none(self):
        data = base64.b64encode(b"\x00\x01\x02\x03\x04\x05").decode()
        result = decode_frame(data)
        assert result is None


class TestDataUrlNoComma:
    """(c) data: prefix with no comma → returns None."""

    def test_data_url_no_comma_returns_none(self):
        # Has "data:" prefix but no comma to separate the payload
        result = decode_frame("data:image/jpeg;base64")
        assert result is None

    def test_data_url_no_comma_long_prefix_returns_none(self):
        result = decode_frame("data:image/png;base64")
        assert result is None


class TestPayloadSizeLimit:
    """(d) String >5MB → returns None (size check before base64 decode)."""

    def test_oversized_payload_returns_none(self):
        # Create a string larger than 5MB — should be rejected by size check
        huge_data = "A" * 5_000_001
        result = decode_frame(huge_data)
        assert result is None

    def test_oversized_payload_skips_decode(self):
        """Verify size check happens BEFORE base64 decode attempt."""
        from unittest.mock import patch
        huge_data = "A" * 5_000_001
        with patch("ws_server.base64.b64decode") as mock_decode:
            result = decode_frame(huge_data)
            assert result is None
            mock_decode.assert_not_called()

    def test_exactly_at_limit_still_works(self, valid_jpeg_base64):
        # The valid JPEG is well under 5MB, should work fine
        assert len(valid_jpeg_base64) < 5_000_000
        result = decode_frame(valid_jpeg_base64)
        assert result is not None


class TestNormalInputStillWorks:
    """(e) Normal valid input still works after hardening."""

    def test_valid_jpeg_returns_ndarray(self, valid_jpeg_base64):
        result = decode_frame(valid_jpeg_base64)
        assert isinstance(result, np.ndarray)
        assert result.shape == (10, 10, 3)

    def test_valid_jpeg_with_data_url_prefix(self, valid_jpeg_base64):
        data_url = f"data:image/jpeg;base64,{valid_jpeg_base64}"
        result = decode_frame(data_url)
        assert isinstance(result, np.ndarray)
        assert result.shape == (10, 10, 3)
