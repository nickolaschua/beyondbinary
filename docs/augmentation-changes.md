# SenseAI Data Augmentation — What Changed and Why

## Problem

Training the LSTM sign language model on raw webcam data (30–60 sequences per sign) produced low accuracy. The model memorized exact hand positions, timing, and angles from the recording session instead of learning generalizable sign patterns. At inference time, even small deviations caused misclassification.

## Root Cause

No data augmentation. The LSTM saw the same lighting, camera angle, hand speed, and position in every sequence. With only 30 sequences per sign and a 90/10 split, the model trained on ~27 examples per class — far too few for a 3-layer LSTM with ~500K parameters.

## What Was Added

### New file: `ml/augment.py`

A data augmentation module with 5 techniques that synthetically increase training data variety:

| Technique | Function | What it does |
|-----------|----------|-------------|
| Gaussian noise | `add_gaussian_noise()` | Adds small random perturbations to non-zero keypoint values. Simulates the natural jitter in MediaPipe landmark tracking. |
| Temporal shift | `temporal_shift()` | Shifts the 30-frame window forward or backward by 1–3 frames, padding with edge frames. Handles timing variation in when a sign starts. |
| Speed variation | `speed_variation()` | Interpolates frames to simulate 15% faster or slower signing. Different people sign at different speeds. |
| Frame dropout | `frame_dropout()` | Randomly replaces interior frames with the previous frame. Builds robustness to webcam frame drops. |
| L/R hand mirror | `mirror_hands()` | Swaps left and right hand keypoint sections. Effectively doubles the dataset. |

The top-level function `augment_dataset(X, y, multiplier=5, use_mirror=True)` applies random combinations of these techniques to each training sample.

### Default behavior (multiplier=5, mirror=on)

With 60 sequences per sign:
- 10 signs x 60 sequences = 600 total
- 90/10 split = 540 train / 60 test
- 540 x (1 original + 5 augmented) = 3,240
- 3,240 x 2 (mirror) = **6,480 training samples**

That's a **12x increase** over raw data, giving the LSTM enough variety to generalize.

### Modified file: `ml/train_model.py`

- Imports `augment_dataset` from the new module
- Added `--augment` flag (default: 5) to control the augmentation multiplier
- Added `--no_mirror` flag to disable L/R hand swapping
- Augmentation runs between the train/test split and model building (Step 2b), so the **test set is never augmented** — it stays as real recorded data for honest evaluation

### Modified file: `ml/training_notebook.ipynb`

- Added Cell 5b between the train/test split and model building
- Self-contained augmentation code (no external imports needed on Colab)
- Controlled by `AUGMENT_MULTIPLIER` and `USE_MIRROR` variables at the top of the cell

### Modified file: `ml/troubleshooting_training.md`

- Added a "Data Augmentation" section documenting all techniques, recommended settings for different data quality levels, and CLI/Colab usage examples

### New file: `ml/tests/test_augment.py`

30 unit tests covering:
- Shape preservation for all augmentation functions
- Zero-padding preservation (undetected body parts stay zero)
- Mirror correctness (L/R swap is exact, double-mirror is identity)
- Original array is never mutated
- Reproducibility with seeded RNG
- Dataset-level augmentation (multiplier scaling, mirror doubling, label preservation)

## Usage

### Local training (CPU)

```bash
cd ml
python train_model.py                          # 5x augmentation + mirror (default)
python train_model.py --augment 8              # more aggressive for sparse data
python train_model.py --augment 0              # disable augmentation
python train_model.py --augment 5 --no_mirror  # no L/R swap
```

### Colab training (GPU)

Run all cells in order. Cell 5b controls augmentation:

```python
AUGMENT_MULTIPLIER = 5   # set to 0 to disable
USE_MIRROR = True        # set False to skip mirroring
```

## Files Changed

```
ml/augment.py                      (new)  — augmentation module
ml/tests/test_augment.py           (new)  — 30 unit tests
ml/train_model.py                  (mod)  — integrated augmentation step
ml/training_notebook.ipynb         (mod)  — added Cell 5b
ml/troubleshooting_training.md     (mod)  — added augmentation docs
```
