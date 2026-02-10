# Product Requirements Document — SenseAI ML Pipeline

## Project Name

SenseAI — Real-Time ASL Sign Language Detection

## Overview

SenseAI is a real-time American Sign Language (ASL) detection system. It uses a webcam to capture hand/body movements, extracts keypoints via MediaPipe Holistic, and classifies signs using an LSTM neural network. A FastAPI WebSocket server enables browser-based real-time inference.

## Goals

- Detect 10 ASL signs in real-time from webcam video
- Serve predictions via WebSocket with <200ms latency per frame
- Maintain a robust, well-tested ML pipeline

## Architecture

### Data Flow

```
Webcam → MediaPipe Holistic → Keypoint Extraction (1662-dim vector)
    → 30-frame sliding window → LSTM Model → Softmax → Predicted Sign
```

### Keypoint Vector (1662 features)

Order is CRITICAL and must never change:
- Pose: 33 landmarks x 4 (x, y, z, visibility) = 132
- Face: 468 landmarks x 3 (x, y, z) = 1404
- Left hand: 21 landmarks x 3 (x, y, z) = 63
- Right hand: 21 landmarks x 3 (x, y, z) = 63

When a body part is not detected, that section is zero-filled.

### 10 ASL Signs

```python
ACTIONS = ['Hello', 'Thank_You', 'Help', 'Yes', 'No',
           'Please', 'Sorry', 'I_Love_You', 'Stop', 'More']
```

### LSTM Model Architecture

```
LSTM(64, tanh, return_sequences=True)  → BatchNorm → Dropout(0.2)
LSTM(128, tanh, return_sequences=True) → BatchNorm → Dropout(0.2)
LSTM(64, tanh, return_sequences=False) → BatchNorm → Dropout(0.2)
Dense(64, relu)
Dense(32, relu)
Dense(10, softmax)
```

Input shape: `(30, 1662)` — 30 frames of 1662 keypoints each.

### Stability Filter

Predictions are stabilized before display. A sign is only reported as "detected" when the same prediction appears for N consecutive frames above a confidence threshold. This prevents flickering.

## Tech Stack

- Python 3.12
- TensorFlow 2.16.2 (CPU, numpy<2 compatible)
- MediaPipe 0.10.21 (last version with mp.solutions.holistic)
- NumPy 1.26.4
- FastAPI 0.128.6 + Uvicorn
- OpenCV 4.11
- scikit-learn 1.6.1
- pytest (test framework)

## File Structure

```
ml/
├── utils.py              # Shared constants, extract_keypoints, mediapipe helpers
├── collect_data.py       # Webcam data collection (30 seq x 30 frames per sign)
├── verify_data.py        # Pre-training data quality check
├── train_model.py        # LSTM training pipeline
├── ws_server.py          # FastAPI WebSocket inference server
├── test_realtime.py      # Local webcam inference test (manual)
├── test_ws_client.py     # WebSocket client test (manual)
├── test_ws_health.py     # Server health check (manual)
├── test_setup.py         # Environment verification (manual)
├── requirements.txt      # Pinned dependencies
├── models/               # Saved model artifacts (.h5)
└── tests/                # pytest test suite (automated)
    ├── __init__.py
    ├── conftest.py       # Shared fixtures
    └── test_*.py         # Test modules
```

## Data Structure

```
MP_Data/
├── Hello/
│   ├── 0/           # Sequence 0
│   │   ├── 0.npy    # Frame 0 keypoints (shape: 1662,)
│   │   ├── 1.npy
│   │   └── ...29.npy
│   ├── 1/           # Sequence 1
│   └── ...29/       # Sequence 29
├── Thank_You/
└── ... (10 actions total)
```

## Known Issues to Address

1. No automated test suite — only manual test scripts exist
2. `train_model.py` and `verify_data.py` duplicate constants from `utils.py`
3. Stability filter logic is duplicated between `ws_server.py` and `test_realtime.py`
4. `decode_frame` in `ws_server.py` has no input validation
5. `ws_server.py` crashes on startup if model file is missing
6. `load_data` in `train_model.py` uses broad exception handling
