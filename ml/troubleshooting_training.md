# Training Troubleshooting Guide

Quick reference for common issues when training the SenseAI sign language LSTM model.

## Common Problems and Solutions

| Problem | Symptoms | Solution |
|---------|----------|----------|
| Low accuracy (<80%) | Test accuracy below 80% after full training | Reduce to 5-7 most distinct signs, check confusion matrix for which signs overlap |
| Two signs always confused | Confusion matrix shows high off-diagonal values between two specific classes | Re-record one of the confused signs with more exaggerated, distinct movements |
| Overfitting (high train, low test) | >15% gap between training and test accuracy | Increase Dropout to 0.3, reduce max epochs, add more training data |
| Underfitting (low train AND test) | Both train and test accuracy remain low (<60%) | Data quality issue -- re-run verify_data.py to check for corrupted or malformed sequences |
| Predicts one class for everything | Classification report shows 0% recall for all but one class | Class imbalance or bad data -- verify each action has equal number of sequences |
| OOM error on Colab | "ResourceExhausted" or "Out of Memory" during training | Reduce `batch_size` to 8, or restart runtime and try again |
| Training is extremely slow | Each epoch takes >60 seconds on Colab | Verify GPU runtime is selected (Runtime > Change runtime type > T4 GPU) |
| NaN loss during training | Loss shows `nan` after a few epochs | Reduce learning rate (use `Adam(learning_rate=0.0005)`), check for NaN in input data |
| Model file too large | `action_model.h5` is unexpectedly large (>100MB) | This is normal for 1662-feature input; the model has ~500K parameters |
| Cannot load model after training | `load_model()` throws error | Ensure you saved with `.h5` extension; check TensorFlow version compatibility |

## Model Architecture Reference

The model MUST use this exact architecture:

```
LSTM(64, tanh, return_sequences=True)  -> BatchNorm -> Dropout(0.2)
LSTM(128, tanh, return_sequences=True) -> BatchNorm -> Dropout(0.2)
LSTM(64, tanh, return_sequences=False) -> BatchNorm -> Dropout(0.2)
Dense(64, relu)
Dense(32, relu)
Dense(10, softmax)
```

**Key constraints:**
- LSTM activation MUST be `tanh` (not relu) -- relu causes gradient issues with LSTM gates
- Input shape: `(30, 1662)` -- 30 frames of 1662 keypoint features
- Feature order: `[pose(33x4), face(468x3), left_hand(21x3), right_hand(21x3)]`

## Expected Training Metrics

| Metric | Good | Acceptable | Needs Work |
|--------|------|------------|------------|
| Test Accuracy | >90% | 80-90% | <80% |
| Train-Test Gap | <5% | 5-15% | >15% (overfitting) |
| Training Time (Colab T4) | <5 min | 5-10 min | >10 min (check GPU) |
| Epochs to Converge | 50-100 | 100-150 | >150 (data issue) |

## Data Augmentation

The training script now includes built-in augmentation (`--augment` flag, default: 5x multiplier).
This is **critical** when training on limited webcam data (30 sequences per sign).

### What augmentation does

| Technique | Effect | Why it helps |
|-----------|--------|-------------|
| Gaussian noise | Adds small random perturbations to keypoint values | Simulates MediaPipe tracking jitter between frames |
| Temporal shift | Shifts frame window by 1-3 frames | Handles timing variation in when a sign starts |
| Speed variation | Stretches/compresses the timeline by 15% | Different people sign at different speeds |
| Frame dropout | Replaces random frames with previous frame | Builds robustness to webcam frame drops |
| L/R mirror | Swaps left and right hand keypoints | Doubles data; some signs work with either hand |

### Recommended settings

| Data quality | Multiplier | Mirror | Expected result |
|-------------|------------|--------|-----------------|
| Good (>20 hands/sign) | 5 (default) | Yes | 270 -> 3,240 samples |
| Moderate (15-20 hands/sign) | 8 | Yes | 270 -> 4,860 samples |
| Poor (<15 hands/sign) | Re-record first | - | Fix data before augmenting |

### CLI usage

```bash
python train_model.py                          # Default: 5x augmentation + mirror
python train_model.py --augment 8              # More augmentation for sparse data
python train_model.py --augment 0              # Disable augmentation (raw data only)
python train_model.py --augment 5 --no_mirror  # Augmentation without L/R swap
```

### Colab usage

In Cell 5b of the training notebook, set:
```python
AUGMENT_MULTIPLIER = 5   # or 8 for more augmentation
USE_MIRROR = True        # set False to disable mirroring
```

## Hyperparameter Tuning Guide

If the default settings are not working well:

1. **First try**: Adjust `patience` (default: 30)
   - Increase to 50 if model is still improving when stopped
   - Decrease to 15 if overfitting is obvious early

2. **Second try**: Adjust `batch_size` (default: 16)
   - Try 8 for more stable gradients (slower)
   - Try 32 for faster training (less stable)

3. **Third try**: Adjust `Dropout` rate (default: 0.2)
   - Increase to 0.3-0.4 if overfitting
   - Decrease to 0.1 if underfitting

4. **Last resort**: Adjust learning rate
   ```python
   from tensorflow.keras.optimizers import Adam
   model.compile(optimizer=Adam(learning_rate=0.0005), ...)
   ```

## Data Quality Checklist

Before training, verify:

- [ ] Each action has exactly 30 sequence directories (0-29)
- [ ] Each sequence has exactly 30 frame files (0.npy through 29.npy)
- [ ] Each .npy file has shape `(1662,)` with no NaN values
- [ ] No empty or zero-filled frames
- [ ] Data was recorded with consistent lighting and background
- [ ] Signs are performed clearly and completely within each sequence

## Local vs Colab Training

| Feature | Local (`train_model.py`) | Colab (`training_notebook.ipynb`) |
|---------|--------------------------|-----------------------------------|
| GPU | CPU only (slow) | T4 GPU (fast) |
| Time for 300 sequences | 30-60 minutes | 5-10 minutes |
| Setup | `pip install tensorflow scikit-learn matplotlib seaborn` | Pre-installed |
| Data location | Local `MP_Data/` directory | Google Drive upload |
| Best for | Quick testing, debugging | Full training runs |
