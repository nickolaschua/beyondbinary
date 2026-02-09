# Agent 1: Foundation (Phases 1-2)

## Working Directory
```
C:\Users\nicko\Desktop\beyondbinary\worktrees\agent-1-foundation
```

## Branch
`agent/foundation`

## Mission
Set up the complete ML development environment and create the shared utility module that ALL other agents depend on. You are the first domino — nothing else can run until your code works.

## What You Deliver

### 1. Project structure (`ml/` directory)
```
ml/
├── venv/                  (Python virtual environment — NOT committed)
├── MP_Data/               (will be populated later — NOT committed)
├── models/                (will hold .h5 — create empty dir)
├── utils.py               (shared utility functions)
├── test_setup.py          (environment verification script)
├── requirements.txt       (pinned dependencies)
└── .gitignore             (venv, MP_Data, __pycache__, etc.)
```

### 2. `ml/requirements.txt`
```
numpy==1.24.3
opencv-python==4.9.0.80
mediapipe==0.10.14
tensorflow==2.15.0
fastapi==0.109.0
uvicorn==0.27.0
websockets==12.0
python-multipart==0.0.6
scikit-learn==1.4.0
matplotlib==3.8.2
```

### 3. `ml/.gitignore`
```
venv/
MP_Data/
__pycache__/
*.pyc
.ipynb_checkpoints/
logs/
```

### 4. `ml/test_setup.py`
Environment verification script. Must:
- Import cv2, mediapipe, numpy, tensorflow
- Print all library versions
- Test webcam access (cv2.VideoCapture(0), read one frame, report shape)
- Test MediaPipe Holistic (process the webcam frame, report which landmarks detected)
- Print clear PASS/FAIL status

### 5. `ml/utils.py`
Shared utility functions used by ALL other scripts. This is the critical contract.

**Functions to implement:**

```python
ACTIONS = np.array([
    'Hello', 'Thank_You', 'Help', 'Yes', 'No',
    'Please', 'Sorry', 'I_Love_You', 'Stop', 'More'
])

SEQUENCE_LENGTH = 30
NUM_SEQUENCES = 30
DATA_PATH = os.path.join('MP_Data')
MODEL_PATH = os.path.join('models', 'action_model.h5')
```

```python
def mediapipe_detection(image, model):
    """
    Run MediaPipe Holistic detection on a BGR frame.
    Returns (BGR image for display, MediaPipe results object).
    """
```

```python
def draw_landmarks(image, results):
    """
    Draw all detected landmarks on frame (face mesh, pose, both hands).
    Uses FACEMESH_CONTOURS (not deprecated FACE_CONNECTIONS).
    Color scheme:
    - Face: green tones
    - Pose: red/purple tones
    - Left hand: pink/purple
    - Right hand: orange/pink
    """
```

```python
def extract_keypoints(results):
    """
    Extract all landmarks into flat numpy array of length 1662.

    Order: [pose, face, lh, rh]  ← CRITICAL, do not change
    - Pose: 33 landmarks × 4 (x, y, z, visibility) = 132
    - Face: 468 landmarks × 3 (x, y, z) = 1404
    - Left hand: 21 landmarks × 3 (x, y, z) = 63
    - Right hand: 21 landmarks × 3 (x, y, z) = 63
    Total: 1662

    If a body part not detected, return zeros for that section.
    """
```

## Technical Constraints

- **Python**: 3.9, 3.10, or 3.11 ONLY. MediaPipe has no wheels for 3.12+ on Windows.
- **MediaPipe API**: Use `mp.solutions.holistic` with `FACEMESH_CONTOURS` (not `FACE_CONNECTIONS`)
- **Keypoint order**: `[pose, face, lh, rh]` — this is a hard contract. Agent 3 (training) and Agent 4 (serving) depend on this exact order.

## Verification

Before committing, verify:
- [ ] `python test_setup.py` passes (all imports, webcam, MediaPipe)
- [ ] `utils.py` can be imported without errors
- [ ] `extract_keypoints` returns shape `(1662,)` array
- [ ] `draw_landmarks` uses `FACEMESH_CONTOURS`

## Git

```bash
cd C:\Users\nicko\Desktop\beyondbinary\worktrees\agent-1-foundation
# Work in ml/ directory
# When done:
git add ml/
git commit -m "feat(01-02): foundation - environment setup and shared utilities

- requirements.txt with pinned dependencies
- test_setup.py for environment verification
- utils.py with extract_keypoints, mediapipe_detection, draw_landmarks
- Project structure with .gitignore

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

## IMPORTANT
- Do NOT create collect_data.py, test_realtime.py, ws_server.py, or any training code
- Do NOT record any data or train any models
- Your ONLY job is the environment + utils.py
- Other agents import from your utils.py — get the interface right
