"""
transformer_model.py — Lightweight Transformer Encoder for SenseAI

Architecture (from ML_UPGRADE_SPEC.md):
    Input: (batch, 30, 1662)
      → Linear projection: 1662 → 128
      → Learned positional encoding (30 positions)
      → 2x Transformer Encoder blocks (4 heads, d_model=128, d_ff=256)
      → Global average pooling
      → Dense(64, relu) → Dropout(0.2)
      → Dense(num_classes, softmax)

~200K parameters. Drop-in replacement for the LSTM build_model().
"""

import tensorflow as tf
from tensorflow.keras import layers, Model


class LearnedPositionalEncoding(layers.Layer):
    """Learned positional encoding for sequence positions."""

    def __init__(self, max_len, d_model, **kwargs):
        super().__init__(**kwargs)
        self.max_len = max_len
        self.d_model = d_model
        self.pos_embedding = layers.Embedding(max_len, d_model)

    def call(self, x):
        seq_len = tf.shape(x)[1]
        positions = tf.range(seq_len)
        return x + self.pos_embedding(positions)

    def get_config(self):
        config = super().get_config()
        config.update({"max_len": self.max_len, "d_model": self.d_model})
        return config


class TransformerEncoderBlock(layers.Layer):
    """Single Transformer encoder block: MHA → Add&Norm → FFN → Add&Norm."""

    def __init__(self, d_model, num_heads, d_ff, dropout_rate=0.1, **kwargs):
        super().__init__(**kwargs)
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_ff = d_ff
        self.dropout_rate = dropout_rate

        self.mha = layers.MultiHeadAttention(
            num_heads=num_heads, key_dim=d_model // num_heads
        )
        self.ffn = tf.keras.Sequential([
            layers.Dense(d_ff, activation="relu"),
            layers.Dense(d_model),
        ])
        self.norm1 = layers.LayerNormalization()
        self.norm2 = layers.LayerNormalization()
        self.dropout1 = layers.Dropout(dropout_rate)
        self.dropout2 = layers.Dropout(dropout_rate)

    def call(self, x, training=False):
        # Multi-head self-attention
        attn_output = self.mha(x, x, training=training)
        attn_output = self.dropout1(attn_output, training=training)
        x = self.norm1(x + attn_output)

        # Feed-forward network
        ffn_output = self.ffn(x)
        ffn_output = self.dropout2(ffn_output, training=training)
        x = self.norm2(x + ffn_output)
        return x

    def get_config(self):
        config = super().get_config()
        config.update({
            "d_model": self.d_model,
            "num_heads": self.num_heads,
            "d_ff": self.d_ff,
            "dropout_rate": self.dropout_rate,
        })
        return config


def build_transformer_model(
    seq_length: int = 30,
    num_features: int = 1662,
    num_classes: int = 10,
    d_model: int = 128,
    num_heads: int = 4,
    d_ff: int = 256,
    num_layers: int = 2,
    dropout_rate: float = 0.2,
    learning_rate: float = 0.001,
) -> Model:
    """
    Build lightweight Transformer encoder for sign language classification.

    Args:
        seq_length: Number of frames per sequence (30)
        num_features: Keypoint features per frame (1662)
        num_classes: Number of sign classes (10)
        d_model: Transformer hidden dimension (128)
        num_heads: Number of attention heads (4)
        d_ff: Feed-forward hidden dimension (256)
        num_layers: Number of encoder blocks (2)
        dropout_rate: Dropout rate (0.2)
        learning_rate: Adam learning rate

    Returns:
        Compiled Keras Model
    """
    inputs = layers.Input(shape=(seq_length, num_features))

    # Linear projection: 1662 → d_model
    x = layers.Dense(d_model)(inputs)

    # Learned positional encoding
    x = LearnedPositionalEncoding(max_len=seq_length, d_model=d_model)(x)
    x = layers.Dropout(dropout_rate)(x)

    # Transformer encoder blocks
    for _ in range(num_layers):
        x = TransformerEncoderBlock(
            d_model=d_model,
            num_heads=num_heads,
            d_ff=d_ff,
            dropout_rate=dropout_rate,
        )(x)

    # Global average pooling over sequence dimension
    x = layers.GlobalAveragePooling1D()(x)

    # Classification head
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(dropout_rate)(x)
    x = layers.Dense(num_classes, activation="softmax")(x)

    model = Model(inputs=inputs, outputs=x)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss="categorical_crossentropy",
        metrics=["categorical_accuracy"],
    )

    return model
