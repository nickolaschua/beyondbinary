# Technology Stack

**Analysis Date:** 2026-02-10

## Languages

**Primary:**
- Python 3.12 - All application code (`ml/*.py`)

**Secondary:**
- Jupyter Notebooks - Training and exploration (`ml/training_notebook.ipynb`, `notebook1_nick.ipynb`, `notebook2_somyansh.ipynb`)

## Runtime

**Environment:**
- Python 3.12 (previously constrained to 3.9-3.11 for MediaPipe Windows wheels; all deps now updated)
- Google Colab T4 GPU for model training (`ml/training_notebook.ipynb`)
- No browser runtime (ML pipeline only)

**Package Manager:**
- pip (standard Python)
- Lockfile: None (no poetry.lock, Pipfile.lock)
- Dependencies pinned in `ml/requirements.txt`

## Frameworks

**Core:**
- TensorFlow 2.20.0 - LSTM model training and inference (`ml/train_model.py`, `ml/ws_server.py`)
- FastAPI 0.128.6 - WebSocket server and HTTP endpoints (`ml/ws_server.py`)
- MediaPipe 0.10.32 - Real-time pose, hand, and face landmark detection (`ml/utils.py`, `ml/collect_data.py`)

**Testing:**
- Manual integration tests via executable Python scripts (`ml/test_setup.py`, `ml/test_realtime.py`, `ml/test_ws_client.py`, `ml/test_ws_health.py`)
- No formal test framework (no pytest, unittest)

**Build/Dev:**
- Uvicorn 0.40.0 - ASGI server (`ml/ws_server.py`)
- Google Colab - GPU-accelerated training environment (`ml/training_notebook.ipynb`)

## Key Dependencies

**Critical:**
- TensorFlow 2.20.0 - LSTM model architecture, training, and inference (`ml/train_model.py`, `ml/ws_server.py`)
- MediaPipe 0.10.32 - Holistic pose/hand/face landmark detection (`ml/utils.py`)
- OpenCV 4.13.0.92 - Webcam capture, frame encoding/decoding, visualization (`ml/collect_data.py`, `ml/ws_server.py`, `ml/test_realtime.py`)
- NumPy 2.4.2 - Array operations, keypoint manipulation, data I/O (`ml/utils.py`, `ml/train_model.py`)
- scikit-learn 1.8.0 - Train/test splitting, confusion matrix, classification report (`ml/train_model.py`)

**Infrastructure:**
- FastAPI 0.128.6 - HTTP + WebSocket server (`ml/ws_server.py`)
- Uvicorn 0.40.0 - ASGI server runtime (`ml/ws_server.py`)
- websockets 16.0 - WebSocket client for testing (`ml/test_ws_client.py`)
- python-multipart 0.0.22 - Form data handling for FastAPI (`ml/ws_server.py`)
- Matplotlib 3.10.8 - Training visualization and confusion matrix plots (`ml/train_model.py`)

## Configuration

**Environment:**
- No environment variables required (all configuration hardcoded)
- No .env files detected
- Configuration via module-level constants in `ml/utils.py`, `ml/ws_server.py`
- CLI arguments supported in `ml/train_model.py` (--epochs, --batch_size, --data_path, --output_dir)

**Build:**
- `ml/requirements.txt` - Pinned dependency versions (Python 3.12 compatible)
- `.planning/config.json` - Project planning mode configuration

## Platform Requirements

**Development:**
- Windows (primary), macOS/Linux compatible
- Webcam required for data collection and real-time testing
- Python 3.12 with pip
- No Docker or external services needed

**Production:**
- FastAPI + Uvicorn on port 8001
- Trained model file: `models/action_model.h5` (~50-100 MB)
- CPU-only inference (no GPU required for serving)
- Google Colab T4 GPU for model training (optional, faster than local CPU)

---

*Stack analysis: 2026-02-10*
*Update after major dependency changes*
