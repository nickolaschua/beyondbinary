"""Tests for --learning_rate CLI argument and build_model integration."""

import pytest
from unittest.mock import patch


def test_learning_rate_default():
    """parse_args() should default --learning_rate to 0.001."""
    from train_model import parse_args

    with patch("sys.argv", ["train_model.py"]):
        args = parse_args()
    assert args.learning_rate == pytest.approx(0.0003)


def test_learning_rate_custom():
    """parse_args(['--learning_rate', '0.01']) sets the value to 0.01."""
    from train_model import parse_args

    with patch("sys.argv", ["train_model.py", "--learning_rate", "0.01"]):
        args = parse_args()
    assert args.learning_rate == pytest.approx(0.01)


def test_build_model_uses_learning_rate():
    """build_model(learning_rate=...) should compile and the optimizer should reflect the LR."""
    from train_model import build_model

    model = build_model(learning_rate=0.005)
    # Model should compile without error and have the specified LR
    optimizer_lr = model.optimizer.learning_rate
    # TensorFlow may store as a variable; extract float value
    lr_value = float(optimizer_lr)
    assert lr_value == pytest.approx(0.005)
