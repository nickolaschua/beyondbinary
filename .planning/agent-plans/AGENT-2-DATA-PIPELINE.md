# Agent 2: Data Pipeline (Phases 3 + 5)

## Working Directory
```
C:\Users\nicko\Desktop\beyondbinary\worktrees\agent-2-data-pipeline
```

## Branch
`agent/data-pipeline`

## Mission
Build the data collection and data verification scripts. These are the tools the human (ML Lead) uses to record ASL signs from their webcam and verify the data quality before training.

## Dependencies
You depend on Agent 1's `ml/utils.py` for:
- `ACTIONS`, `SEQUENCE_LENGTH`, `NUM_SEQUENCES`, `DATA_PATH` constants
- `mediapipe_detection(image, model)` function
- `draw_landmarks(image, results)` function
- `extract_keypoints(results)` function

**Write your code importing from utils.py.** If Agent 1 isn't done yet, you know the exact interface (see below) — write against it.

### Interface Contract (from utils.py)
```python
ACTIONS = np.array(['Hello', 'Thank_You', 'Help', 'Yes', 'No', 'Please', 'Sorry', 'I_Love_You', 'Stop', 'More'])
SEQUENCE_LENGTH = 30
NUM_SEQUENCES = 30
DATA_PATH = 'MP_Data'

def mediapipe_detection(image, model) -> tuple[np.ndarray, Any]: ...
def draw_landmarks(image, results) -> None: ...
def extract_keypoints(results) -> np.ndarray:  # shape (1662,)
```

## What You Deliver

### 1. `ml/collect_data.py`

Data collection script that records ASL sign keypoints from webcam.

**Behavior:**
- Opens webcam (640x480)
- Creates `MP_Data/{action}/{sequence}/` directory structure
- For each of 10 actions, records 30 sequences of 30 frames each
- Each frame: run MediaPipe Holistic → extract keypoints → save as `.npy`
- Shows live webcam feed with landmarks drawn + status overlay
- At start of each sequence: "STARTING COLLECTION" message + 500ms pause
- During recording: shows `Sign: {action} | Seq: {n} | Frame: {n}` overlay
- **Resume support**: checks if sequence directory already has data, skips if exists
- Press 'q' to quit at any time
- Prints progress to console: `✓ Sequence {n}/{total} recorded`

**Import from utils.py:**
```python
from utils import (ACTIONS, SEQUENCE_LENGTH, NUM_SEQUENCES, DATA_PATH,
                   mediapipe_detection, draw_landmarks, extract_keypoints)
```

**Key details:**
- Camera resolution: 640x480 (`cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)`)
- MediaPipe Holistic: `min_detection_confidence=0.5, min_tracking_confidence=0.5`
- Save path: `os.path.join(DATA_PATH, action, str(sequence), str(frame_num))` → `np.save()`
- Resume check: `os.path.exists(os.path.join(DATA_PATH, action, str(sequence), '0.npy'))`
- OpenCV window title: `'SenseAI Data Collection'`
- Status text color: `(0, 0, 255)` red for info, `(0, 255, 0)` green for "STARTING"
- `cv2.waitKey(500)` pause at frame 0 of each sequence
- `cv2.waitKey(10)` during recording for 'q' check

### 2. `ml/verify_data.py`

Data verification script to run AFTER recording, BEFORE training.

**Behavior:**
- For each action in ACTIONS:
  - Count number of sequences in the action directory
  - Load a sample frame, check shape is `(1662,)`
  - For each sequence, check the middle frame (frame 15) for hand detection:
    - Left hand landmarks at indices `1536:1599` (after pose 132 + face 1404 = 1536)
    - Right hand landmarks at indices `1599:1662`
    - If either is non-zero → hands detected for that sequence
  - Report: `{action:15s} | {num_sequences:2d} sequences | shape: {shape} | hands detected: {count}/{total}`
- Print expected shape reminder: `(1662,)`
- Print warning if any sign has <20/30 hands detected: "Re-record that sign with better lighting/positioning"
- Exit with code 1 if any sign has <15/30 hands detected (critical failure)

**No imports from utils.py needed** (just numpy + os). Keep it standalone for simplicity.

## Technical Constraints

- All scripts must run on Windows with Python 3.9-3.11
- Use `os.path.join()` for all paths (Windows compatibility)
- `collect_data.py` must handle the user pressing 'q' gracefully (release camera, close windows)
- Do NOT use `FACE_CONNECTIONS` (deprecated) — but you shouldn't need face drawing in these scripts anyway (that's in utils.py)

## Verification

Before committing, verify:
- [ ] `collect_data.py` imports from utils.py without errors
- [ ] Running `collect_data.py` opens webcam, shows landmarks, creates MP_Data directories
- [ ] Pressing 'q' exits cleanly
- [ ] Resume support works (re-running skips existing sequences)
- [ ] `verify_data.py` correctly reads .npy files and reports hand detection rates
- [ ] `verify_data.py` exits with code 1 if hand detection is critically low

## Git

```bash
cd C:\Users\nicko\Desktop\beyondbinary\worktrees\agent-2-data-pipeline
# Work in ml/ directory
# When done:
git add ml/collect_data.py ml/verify_data.py
git commit -m "feat(03-05): data pipeline - collection and verification scripts

- collect_data.py: webcam recording with resume support, 10 ASL signs
- verify_data.py: data quality checks before training
- Imports shared utilities from utils.py

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

## IMPORTANT
- Do NOT create utils.py (Agent 1 does that)
- Do NOT create any training code or model files (Agent 3)
- Do NOT create WebSocket server or inference scripts (Agent 4)
- Do NOT record actual data (the human ML Lead does Phase 4 manually)
- Your ONLY job is collect_data.py + verify_data.py
