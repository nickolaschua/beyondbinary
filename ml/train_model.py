"""
train_model.py - Local CPU Training Script for SenseAI Sign Language Model

Trains a 3-layer LSTM classifier on MediaPipe keypoint sequences.
Same architecture as the Google Colab notebook but runs locally on CPU.

Usage:
    python ml/train_model.py
    python ml/train_model.py --data_path ./MP_Data --epochs 200 --batch_size 16

Expected data structure:
    MP_Data/
        Hello/0/0.npy ... 29.npy
        Hello/1/0.npy ... 29.npy
        ...
        More/29/0.npy ... 29.npy

Each .npy file: numpy array of shape (1662,)
    [pose(33x4), face(468x3), left_hand(21x3), right_hand(21x3)]
"""

import argparse
import os
import sys
import logging
from datetime import datetime

import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, classification_report

from utils import ACTIONS, NUM_SEQUENCES, SEQUENCE_LENGTH, NUM_FEATURES, strip_face_features, normalize_frame
from augment import augment_dataset

# Set random seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
RAW_FEATURES = 1662  # pose(132) + face(1404) + lh(63) + rh(63)
# NUM_FEATURES (258) imported from utils — pose(132) + lh(63) + rh(63)


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Train SenseAI sign language LSTM model (CPU)"
    )
    parser.add_argument(
        "--data_path",
        type=str,
        default=os.path.join(os.path.dirname(os.path.dirname(__file__)), "MP_Data"),
        help="Path to the MP_Data directory (default: ../MP_Data relative to script)",
    )
    parser.add_argument(
        "--epochs", type=int, default=500, help="Maximum training epochs (default: 500)"
    )
    parser.add_argument(
        "--batch_size", type=int, default=16, help="Training batch size (default: 16)"
    )
    parser.add_argument(
        "--patience", type=int, default=50, help="EarlyStopping patience (default: 50)"
    )
    parser.add_argument(
        "--test_size",
        type=float,
        default=0.1,
        help="Fraction of data for test set (default: 0.1)",
    )
    parser.add_argument(
        "--learning_rate",
        type=float,
        default=0.0003,
        help="Adam optimizer learning rate (default: 0.0003)",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default=".",
        help="Directory to save model and artifacts (default: current dir)",
    )
    parser.add_argument(
        "--augment",
        type=int,
        default=3,
        help="Augmentation multiplier per sample (default: 3, set 0 to disable)",
    )
    parser.add_argument(
        "--no_mirror",
        action="store_true",
        help="Disable left/right hand mirror augmentation",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------
def load_data(data_path: str):
    """
    Load keypoint sequences from the MP_Data directory.

    Returns:
        X: np.ndarray of shape (N, SEQUENCE_LENGTH, NUM_FEATURES)
        y: np.ndarray of one-hot encoded labels, shape (N, len(ACTIONS))
        skipped: int count of skipped sequences
    """
    label_map = {label: num for num, label in enumerate(ACTIONS)}

    sequences = []
    labels = []
    skipped = 0

    for action in ACTIONS:
        action_path = os.path.join(data_path, action)
        if not os.path.isdir(action_path):
            logger.warning("Action directory not found: %s", action_path)
            continue

        for seq_idx in range(NUM_SEQUENCES):
            seq_path = os.path.join(action_path, str(seq_idx))
            if not os.path.isdir(seq_path):
                logger.warning("Sequence directory not found: %s", seq_path)
                skipped += 1
                continue

            window = []
            valid = True
            for frame_idx in range(SEQUENCE_LENGTH):
                frame_path = os.path.join(seq_path, f"{frame_idx}.npy")
                if not os.path.isfile(frame_path):
                    logger.warning("Missing frame: %s", frame_path)
                    valid = False
                    break
                try:
                    frame = np.load(frame_path)
                    if frame.shape != (RAW_FEATURES,):
                        logger.warning(
                            "Unexpected shape %s in %s (expected (%d,))",
                            frame.shape,
                            frame_path,
                            RAW_FEATURES,
                        )
                        valid = False
                        break
                    window.append(frame)
                except (ValueError, OSError, EOFError) as e:
                    logger.warning("Error loading %s: %s", frame_path, e)
                    valid = False
                    break

            if valid and len(window) == SEQUENCE_LENGTH:
                sequences.append(window)
                labels.append(label_map[action])
            else:
                skipped += 1

    if len(sequences) == 0:
        logger.error("No valid sequences found in %s", data_path)
        sys.exit(1)

    X = np.array(sequences)
    y_raw = np.array(labels)

    # Strip face features: [pose, face, lh, rh] (1662) -> [pose, lh, rh] (258)
    X_stripped = np.zeros((X.shape[0], X.shape[1], NUM_FEATURES))
    for i in range(X.shape[0]):
        for f in range(X.shape[1]):
            X_stripped[i, f] = strip_face_features(X[i, f])
    X = X_stripped

    # Normalize landmarks: center on nose, scale by shoulder width
    for i in range(X.shape[0]):
        for f in range(X.shape[1]):
            X[i, f] = normalize_frame(X[i, f])

    # One-hot encode
    from tensorflow.keras.utils import to_categorical

    y = to_categorical(y_raw, num_classes=len(ACTIONS))

    logger.info("Loaded %d sequences, skipped %d", len(sequences), skipped)
    logger.info("X shape (face stripped + normalized): %s", X.shape)
    logger.info("y shape: %s", y.shape)

    # Report per-class counts
    for i, action in enumerate(ACTIONS):
        count = np.sum(y_raw == i)
        logger.info("  %s: %d sequences", action, count)

    return X, y, skipped


# ---------------------------------------------------------------------------
# Model Architecture
# ---------------------------------------------------------------------------
def build_model(learning_rate: float = 0.001):
    """
    Build the Bidirectional LSTM model for sign language classification.

    Architecture:
        Bidirectional(LSTM(64)) -> BatchNorm -> Dropout(0.5)
        Dense(32, relu) -> Dropout(0.4)
        Dense(10, softmax)
    """
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization, Bidirectional

    model = Sequential([
        Bidirectional(LSTM(64), input_shape=(SEQUENCE_LENGTH, NUM_FEATURES)),
        BatchNormalization(),
        Dropout(0.5),

        Dense(32, activation="relu"),
        Dropout(0.4),
        Dense(len(ACTIONS), activation="softmax"),
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss="categorical_crossentropy",
        metrics=["categorical_accuracy"],
    )

    return model


# ---------------------------------------------------------------------------
# Plotting Utilities
# ---------------------------------------------------------------------------
def plot_confusion_matrix(y_true, y_pred, output_dir: str):
    """Generate and save a confusion matrix heatmap."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import seaborn as sns

    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(12, 10))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=ACTIONS,
        yticklabels=ACTIONS,
    )
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.title("Confusion Matrix")
    plt.tight_layout()
    save_path = os.path.join(output_dir, "confusion_matrix.png")
    plt.savefig(save_path, dpi=150)
    plt.close()
    logger.info("Confusion matrix saved to %s", save_path)


def plot_training_history(history, output_dir: str):
    """Generate and save accuracy/loss training history plots."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Accuracy
    axes[0].plot(history.history["categorical_accuracy"], label="Train Accuracy")
    axes[0].plot(history.history["val_categorical_accuracy"], label="Val Accuracy")
    axes[0].set_title("Model Accuracy")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Accuracy")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    # Loss
    axes[1].plot(history.history["loss"], label="Train Loss")
    axes[1].plot(history.history["val_loss"], label="Val Loss")
    axes[1].set_title("Model Loss")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Loss")
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    save_path = os.path.join(output_dir, "training_history.png")
    plt.savefig(save_path, dpi=150)
    plt.close()
    logger.info("Training history plot saved to %s", save_path)


# ---------------------------------------------------------------------------
# Main Training Pipeline
# ---------------------------------------------------------------------------
def main():
    args = parse_args()

    logger.info("=" * 60)
    logger.info("SenseAI Sign Language Model - Local Training (CPU)")
    logger.info("=" * 60)
    logger.info("Data path:   %s", args.data_path)
    logger.info("Epochs:      %d", args.epochs)
    logger.info("Batch size:  %d", args.batch_size)
    logger.info("Patience:    %d", args.patience)
    logger.info("Test size:   %.1f%%", args.test_size * 100)
    logger.info("Output dir:  %s", args.output_dir)
    logger.info("Augment:     %dx%s", args.augment,
                " (no mirror)" if args.no_mirror else " + mirror")
    logger.info("")

    # Validate data path
    if not os.path.isdir(args.data_path):
        logger.error("Data path does not exist: %s", args.data_path)
        logger.error("Please provide a valid --data_path to the MP_Data directory.")
        sys.exit(1)

    # Create output directory if needed
    os.makedirs(args.output_dir, exist_ok=True)

    # -----------------------------------------------------------------------
    # Step 1: Load Data
    # -----------------------------------------------------------------------
    logger.info("Step 1/5: Loading data...")
    X, y, skipped = load_data(args.data_path)

    # -----------------------------------------------------------------------
    # Step 2: Train/Val/Test Split (BEFORE augmentation to prevent leakage)
    # -----------------------------------------------------------------------
    logger.info("Step 2/5: Splitting data...")

    # Need integer labels for stratification
    y_integers = np.argmax(y, axis=1)

    # First split: separate test set
    X_trainval, X_test, y_trainval, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=42, stratify=y_integers
    )

    # Second split: separate validation set from training data
    y_tv_integers = np.argmax(y_trainval, axis=1)
    X_train, X_val, y_train, y_val = train_test_split(
        X_trainval, y_trainval, test_size=0.15, random_state=42, stratify=y_tv_integers
    )

    logger.info("Training samples:   %d", len(X_train))
    logger.info("Validation samples: %d", len(X_val))
    logger.info("Test samples:       %d", len(X_test))

    # -----------------------------------------------------------------------
    # Step 2b: Data Augmentation (training set only)
    # -----------------------------------------------------------------------
    if args.augment > 0:
        logger.info("Step 2b: Augmenting training data (multiplier=%d, mirror=%s)...",
                     args.augment, not args.no_mirror)
        original_count = len(X_train)
        X_train, y_train = augment_dataset(
            X_train, y_train,
            multiplier=args.augment,
            use_mirror=not args.no_mirror,
            seed=42,
        )
        logger.info("Augmented: %d -> %d training samples (%.1fx)",
                     original_count, len(X_train), len(X_train) / original_count)
    else:
        logger.info("Augmentation disabled (--augment 0)")

    # -----------------------------------------------------------------------
    # Step 3: Build Model
    # -----------------------------------------------------------------------
    logger.info("Step 3/5: Building model...")
    model = build_model(learning_rate=args.learning_rate)
    model.summary(print_fn=logger.info)

    # -----------------------------------------------------------------------
    # Step 4: Train
    # -----------------------------------------------------------------------
    logger.info("Step 4/5: Training...")

    from tensorflow.keras.callbacks import TensorBoard, EarlyStopping, ModelCheckpoint

    log_dir = os.path.join(args.output_dir, "logs", datetime.now().strftime("%Y%m%d-%H%M%S"))
    checkpoint_path = os.path.join(args.output_dir, "best_model.h5")

    early_stop = EarlyStopping(
        monitor="val_categorical_accuracy",
        patience=args.patience,
        restore_best_weights=True,
        verbose=1,
    )
    checkpoint = ModelCheckpoint(
        checkpoint_path,
        monitor="val_categorical_accuracy",
        save_best_only=True,
        verbose=1,
    )
    tb_callback = TensorBoard(log_dir=log_dir)

    history = model.fit(
        X_train,
        y_train,
        epochs=args.epochs,
        batch_size=args.batch_size,
        validation_data=(X_val, y_val),
        callbacks=[early_stop, checkpoint, tb_callback],
        verbose=1,
    )

    # Print best validation accuracy
    best_val_acc = max(history.history["val_categorical_accuracy"])
    logger.info("Best validation accuracy: %.4f", best_val_acc)

    # -----------------------------------------------------------------------
    # Step 5: Evaluate on TEST set
    # -----------------------------------------------------------------------
    logger.info("Step 5/5: Evaluating on TEST set...")

    # Load the best model from checkpoint
    from tensorflow.keras.models import load_model

    if os.path.isfile(checkpoint_path):
        model = load_model(checkpoint_path)
        logger.info("Loaded best model from checkpoint: %s", checkpoint_path)

    test_loss, test_acc = model.evaluate(X_test, y_test, verbose=0)
    logger.info("Test Loss:     %.4f", test_loss)
    logger.info("Test Accuracy: %.4f", test_acc)

    # Classification report
    y_pred = model.predict(X_test, verbose=0)
    y_pred_classes = np.argmax(y_pred, axis=1)
    y_true_classes = np.argmax(y_test, axis=1)

    report = classification_report(
        y_true_classes,
        y_pred_classes,
        target_names=ACTIONS.tolist(),
        zero_division=0,
    )
    logger.info("\nClassification Report:\n%s", report)

    # -----------------------------------------------------------------------
    # Generate Plots
    # -----------------------------------------------------------------------
    logger.info("Generating plots...")
    plot_confusion_matrix(y_true_classes, y_pred_classes, args.output_dir)
    plot_training_history(history, args.output_dir)

    # -----------------------------------------------------------------------
    # Save Final Model
    # -----------------------------------------------------------------------
    model_path = os.path.join(args.output_dir, "action_model.h5")
    model.save(model_path)
    logger.info("Model saved to %s", model_path)

    savedmodel_path = os.path.join(args.output_dir, "action_model_savedmodel")
    model.save(savedmodel_path)
    logger.info("SavedModel saved to %s", savedmodel_path)

    actions_path = os.path.join(args.output_dir, "actions.npy")
    np.save(actions_path, ACTIONS)
    logger.info("Actions list saved to %s", actions_path)

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    logger.info("")
    logger.info("=" * 60)
    logger.info("TRAINING COMPLETE")
    logger.info("=" * 60)
    logger.info("Model:             %s", model_path)
    logger.info("Actions:           %s", actions_path)
    logger.info("Confusion matrix:  %s", os.path.join(args.output_dir, "confusion_matrix.png"))
    logger.info("Training history:  %s", os.path.join(args.output_dir, "training_history.png"))
    logger.info("TensorBoard logs:  %s", log_dir)
    logger.info("Test accuracy:     %.2f%%", test_acc * 100)
    logger.info("")
    logger.info("To view TensorBoard: tensorboard --logdir %s", os.path.join(args.output_dir, "logs"))


if __name__ == "__main__":
    main()
