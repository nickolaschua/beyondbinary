# CLAUDE.md — ML Lead: Sign Language Detection Pipeline
## SenseAI | Beyond Binary Hackathon | 48 Hours

---

## ROLE SUMMARY

You are the ML lead for SenseAI, building a real-time ASL (American Sign Language) sign detection pipeline. Your pipeline takes webcam video frames, extracts body/hand/face landmarks using MediaPipe Holistic, classifies sequences of landmarks using an LSTM neural network, and returns detected sign labels with confidence scores.

**Your deliverables:**
1. A data collection script that records ASL sign keypoints from webcam
2. A trained LSTM model (`action_model.h5`) that classifies 10 ASL signs at >90% accuracy
3. A real-time inference script that runs sign detection from webcam locally
4. A FastAPI WebSocket endpoint (`/ws/sign-detection`) that receives video frames from the browser and returns sign predictions
5. Integration with the frontend video call system

**Your machine:** Windows, no local GPU. You will use Google Colab (GPU) for training only. Data collection and real-time inference run locally on Windows.

**Your experience:** You know TensorFlow/Keras but have not used MediaPipe before. This guide covers MediaPipe from scratch.

---

## REFERENCE IMPLEMENTATIONS (Research Findings)

Three open-source repos were evaluated as potential starting points:

### 1. nicknochnack/ActionDetectionforSignLanguage (Nicholas Renotte — Original)
- **Signs:** 3 only (hello, thanks, iloveyou)
- **Architecture:** 3-layer LSTM (64→128→64), `relu` activation, 596,675 params
- **Training:** 2000 epochs, no early stopping, 95/5 train/test split
- **Inference:** Confidence threshold 0.8, NO temporal stability filter
- **Keypoint order:** `[pose, face, lh, rh]` ← WE USE THIS ORDER
- **Ships:** `action.h5` (~6.9 MB)
- **Pros:** Explicit pip install with pinned versions, correct evaluation on X_test
- **Cons:** relu activation for LSTM (suboptimal), no regularization, no stability filter, massive overfitting (2000 epochs on 85 training samples)

### 2. SomyanshAvasthi/Sign-Language-Detection-using-MediaPipe (Cleaned-Up Derivative)
- **Signs:** Same 3 (hello, thanks, iloveyou)
- **Architecture:** Identical to nicknochnack
- **Training:** 330 epochs (more reasonable), same split
- **Inference:** Threshold 0.5 + **10-frame temporal stability filter** (last 10 predictions must agree)
- **Keypoint order:** `[pose, lh, rh, face]` ← DIFFERENT FROM OURS, models not interchangeable
- **Ships:** `action.h5` (~6.9 MB), includes training data folder
- **Pros:** Stability filter (reduces flickering), updated MediaPipe API (`FACEMESH_CONTOURS`), works on Python 3.12 + TF 2.15+
- **Cons:** Bug — evaluates on X_train not X_test. Stability filter has edge case bug with mixed predictions.

### 3. SLRNet (Khushi-739, June 2025 paper)
- **Signs:** 26 ASL letters + 10 functional words
- **Architecture:** MediaPipe Holistic + stacked LSTM, 30-frame sequences
- **Accuracy:** 86.7% validation
- **Fully open source:** https://github.com/Khushi-739/SLRNet

### Decision: Train From Scratch
Neither `.h5` is worth fine-tuning because:
- Both trained on only 3 signs / 90 sequences — LSTM weights are too narrow to transfer meaningfully
- Our model needs `Dense(10)` output layer vs their `Dense(3)` — must replace final layer anyway
- LSTM trains in ~10 min on Colab GPU — fresh training is trivial
- Our architecture is already better (tanh, BatchNorm, Dropout, EarlyStopping)

**What we adopt from these repos:**
- SomyanshAvasthi's temporal stability filter concept (adapted to 8 frames instead of 10)
- nicknochnack's `[pose, face, lh, rh]` keypoint concatenation order
- The general pipeline structure: collect → train → test → serve

---

## ENVIRONMENT SETUP (Windows)

### CRITICAL: Python Version

MediaPipe on Windows requires **Python 3.9, 3.10, or 3.11**. Python 3.12+ does NOT have MediaPipe wheels on Windows. If you have Python 3.12, you MUST install 3.11 alongside it.

Check your version:
```powershell
python --version
```

If it's 3.12+, install Python 3.11 from https://www.python.org/downloads/release/python-3119/ and use a virtual environment pinned to 3.11.

### Create Virtual Environment

```powershell
# Navigate to the ml/ directory in the project
cd senseai\ml

# Create venv with Python 3.11 (adjust path if needed)
# If python3.11 is your default:
python -m venv venv

# If you have multiple Python versions:
py -3.11 -m venv venv

# Activate
.\venv\Scripts\activate
```

### Install Dependencies

```powershell
# Core dependencies - INSTALL IN THIS ORDER to avoid version conflicts
pip install numpy==1.24.3
pip install opencv-python==4.9.0.80
pip install mediapipe==0.10.14
pip install tensorflow==2.15.0
pip install matplotlib
pip install scikit-learn

# For WebSocket server (needed later for backend integration)
pip install fastapi uvicorn websockets python-multipart
```

**If mediapipe install fails:**
```powershell
# Install Visual C++ redistributable first
pip install msvc-runtime
# Then retry
pip install mediapipe==0.10.14
```

### Verify Installation

Create a file `test_setup.py`:
```python
import cv2
import mediapipe as mp
import numpy as np
import tensorflow as tf

print(f"OpenCV: {cv2.__version__}")
print(f"MediaPipe: {mp.__version__}")
print(f"NumPy: {np.__version__}")
print(f"TensorFlow: {tf.__version__}")

# Test webcam
cap = cv2.VideoCapture(0)
ret, frame = cap.read()
if ret:
    print(f"Webcam OK — frame shape: {frame.shape}")
else:
    print("ERROR: Cannot access webcam")
cap.release()

# Test MediaPipe Holistic
mp_holistic = mp.solutions.holistic
with mp_holistic.Holistic(min_detection_confidence=0.5) as holistic:
    if ret:
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = holistic.process(image)
        print(f"Pose landmarks: {'detected' if results.pose_landmarks else 'NOT detected'}")
        print(f"Left hand: {'detected' if results.left_hand_landmarks else 'NOT detected'}")
        print(f"Right hand: {'detected' if results.right_hand_landmarks else 'NOT detected'}")
        print(f"Face landmarks: {'detected' if results.face_landmarks else 'NOT detected'}")

print("\n✅ All imports and webcam working. Ready to proceed.")
```

Run it:
```powershell
python test_setup.py
```

If pose landmarks say "NOT detected", that's fine — you need to be visible in the webcam frame. The important thing is no import errors.

---

## UNDERSTANDING MEDIAPIPE HOLISTIC

Since you haven't used MediaPipe before, here's what you need to know.

### What It Does

MediaPipe Holistic is a multi-stage ML pipeline that detects a person in a video frame and outputs **543 3D landmarks** representing their body:

- **33 pose landmarks**: skeletal structure (shoulders, elbows, wrists, hips, knees, etc.)
- **21 left hand landmarks**: finger joints and tips
- **21 right hand landmarks**: finger joints and tips  
- **468 face landmarks**: facial mesh (eyes, nose, mouth, brows, jawline, etc.)

Each landmark has `(x, y, z, visibility)` for pose or `(x, y, z)` for hands/face, where x and y are normalized to [0, 1] relative to the frame dimensions.

### Why This Matters for Sign Language

ASL signs are defined by three simultaneous channels:
1. **Hand shape** (which fingers are extended, curled, etc.) → captured by the 21 hand landmarks per hand
2. **Hand movement/position relative to body** (near face, chest, etc.) → captured by comparing hand landmarks to pose landmarks
3. **Facial expression** (eyebrow raise, mouth shape) → captured by face landmarks

By extracting all 543 landmarks per frame and feeding a SEQUENCE of frames (30 frames ≈ 1 second) into an LSTM, the model learns the temporal pattern of each sign.

### The API You'll Use

```python
import mediapipe as mp

mp_holistic = mp.solutions.holistic  # The detection model
mp_drawing = mp.solutions.drawing_utils  # For visualizing landmarks on frames

# Usage:
with mp_holistic.Holistic(
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
) as holistic:
    # Convert BGR (OpenCV default) to RGB (MediaPipe requirement)
    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    image_rgb.flags.writeable = False  # Performance optimization
    
    results = holistic.process(image_rgb)
    
    # results.pose_landmarks → 33 landmarks or None
    # results.left_hand_landmarks → 21 landmarks or None
    # results.right_hand_landmarks → 21 landmarks or None
    # results.face_landmarks → 468 landmarks or None
```

### Extracting the Feature Vector

Each frame produces a flat numpy array of landmarks. This is the core function you'll use everywhere:

```python
def extract_keypoints(results):
    """
    Extract all landmarks from a MediaPipe Holistic result into a flat numpy array.
    
    Returns a 1D array of length 1662:
    - Pose: 33 landmarks × 4 values (x, y, z, visibility) = 132
    - Face: 468 landmarks × 3 values (x, y, z) = 1404
    - Left hand: 21 landmarks × 3 values (x, y, z) = 63
    - Right hand: 21 landmarks × 3 values (x, y, z) = 63
    Total: 132 + 1404 + 63 + 63 = 1662
    
    If a body part is not detected, returns zeros for that section.
    This is critical — LSTM needs fixed-size input.
    """
    pose = np.array([[res.x, res.y, res.z, res.visibility] for res in results.pose_landmarks.landmark]).flatten() if results.pose_landmarks else np.zeros(33 * 4)
    face = np.array([[res.x, res.y, res.z] for res in results.face_landmarks.landmark]).flatten() if results.face_landmarks else np.zeros(468 * 3)
    lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten() if results.left_hand_landmarks else np.zeros(21 * 3)
    rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten() if results.right_hand_landmarks else np.zeros(21 * 3)
    return np.concatenate([pose, face, lh, rh])
```

**Why include face landmarks?** Two reasons:
1. Some ASL signs differ only in facial expression (e.g., a question vs. a statement)
2. The face landmarks are ALSO used by the frontend's emotion detection feature — so collecting them now avoids needing a second face detection model

**Alternative: skip face landmarks (258 features per frame).** If training accuracy is fine without face, you can drop them to speed up inference. Try with face first, drop if needed.

---

## STEP 1: DATA COLLECTION

### The 10 Signs to Record

These signs were chosen because they are:
- Visually distinct from each other (different hand shapes and movements)
- Relevant to the SenseAI medical/accessibility context
- Easy to perform without deep ASL knowledge

| # | Sign | ASL Description | Key Visual Features |
|---|------|----------------|-------------------|
| 1 | **Hello** | Open hand wave near face | Open palm, side-to-side movement |
| 2 | **Thank You** | Flat hand from chin forward | Hand starts at chin, moves outward |
| 3 | **Help** | Closed fist on open palm, lift upward | Two-hand sign, upward movement |
| 4 | **Yes** | Closed fist nods up and down | Single fist, vertical movement |
| 5 | **No** | Index + middle finger snap to thumb | Pinching motion, small movement |
| 6 | **Please** | Open hand circles on chest | Circular motion on torso |
| 7 | **Sorry** | Closed fist circles on chest | Similar to Please but with fist |
| 8 | **I Love You** | Pinky + index + thumb extended, others folded | Static hand shape, very distinct |
| 9 | **Stop** | Open palm pushed forward forcefully | Sharp forward motion |
| 10 | **More** | Fingertips of both hands tap together | Two-hand sign, repeated tapping |

**IMPORTANT:** Before recording, watch a 30-second video of each sign on YouTube. Search "ASL [sign name] sign language" and watch 2-3 examples. You do NOT need to be perfect — the model learns from YOUR recordings, so consistency matters more than correctness.

### Directory Structure

```
ml/
├── MP_Data/              ← keypoint data lives here
│   ├── Hello/
│   │   ├── 0/            ← sequence 0 (30 .npy files, one per frame)
│   │   ├── 1/
│   │   ├── ...
│   │   └── 29/           ← sequence 29
│   ├── Thank_You/
│   ├── Help/
│   ├── Yes/
│   ├── No/
│   ├── Please/
│   ├── Sorry/
│   ├── I_Love_You/
│   ├── Stop/
│   └── More/
├── models/
│   └── action_model.h5   ← trained model
├── collect_data.py
├── train_model.py         ← or use the Colab notebook
├── test_realtime.py
├── ws_server.py           ← WebSocket server for frontend integration
└── utils.py               ← shared functions (extract_keypoints, etc.)
```

### Data Collection Script

Create `ml/collect_data.py`:

```python
"""
SenseAI — ASL Sign Language Data Collection
============================================
This script records keypoint sequences for ASL signs using MediaPipe Holistic.

For each sign, it records 30 sequences of 30 frames each.
Each frame's keypoints (1662 values) are saved as a .npy file.

Usage:
    python collect_data.py

Controls:
    - Press 'q' to quit at any time
    - The recording starts automatically after a countdown
    - Hold the sign for the duration of each sequence (~1-2 seconds)
    - Between sequences, you get a brief pause to reset

Tips for good data:
    - Sit at a consistent distance from the camera (arm's length)
    - Ensure your hands and face are well-lit and visible
    - Vary your signing speed slightly between sequences (natural variation helps)
    - Keep your background relatively uncluttered
    - Wear a plain shirt (patterns can confuse hand detection)
"""

import cv2
import numpy as np
import os
import mediapipe as mp
import time

# ========================
# CONFIGURATION
# ========================

# Signs to record — modify this list if you want different/fewer signs
ACTIONS = np.array([
    'Hello', 'Thank_You', 'Help', 'Yes', 'No',
    'Please', 'Sorry', 'I_Love_You', 'Stop', 'More'
])

# Number of sequences (videos) to record per sign
NUM_SEQUENCES = 30

# Number of frames per sequence (30 frames ≈ 1 second at 30fps)
SEQUENCE_LENGTH = 30

# Where to save the data
DATA_PATH = os.path.join('MP_Data')

# ========================
# SETUP
# ========================

mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils

def mediapipe_detection(image, model):
    """Run MediaPipe detection on a frame."""
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image.flags.writeable = False
    results = model.process(image)
    image.flags.writeable = True
    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    return image, results

def draw_landmarks(image, results):
    """Draw all detected landmarks on the frame for visual feedback."""
    # Draw face mesh
    if results.face_landmarks:
        mp_drawing.draw_landmarks(
            image, results.face_landmarks, mp_holistic.FACEMESH_CONTOURS,
            mp_drawing.DrawingSpec(color=(80, 110, 10), thickness=1, circle_radius=1),
            mp_drawing.DrawingSpec(color=(80, 256, 121), thickness=1, circle_radius=1)
        )
    # Draw pose
    if results.pose_landmarks:
        mp_drawing.draw_landmarks(
            image, results.pose_landmarks, mp_holistic.POSE_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(80, 22, 10), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(80, 44, 121), thickness=2, circle_radius=2)
        )
    # Draw left hand
    if results.left_hand_landmarks:
        mp_drawing.draw_landmarks(
            image, results.left_hand_landmarks, mp_holistic.HAND_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(121, 22, 76), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(121, 44, 250), thickness=2, circle_radius=2)
        )
    # Draw right hand
    if results.right_hand_landmarks:
        mp_drawing.draw_landmarks(
            image, results.right_hand_landmarks, mp_holistic.HAND_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(245, 117, 66), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(245, 66, 230), thickness=2, circle_radius=2)
        )

def extract_keypoints(results):
    """Extract all landmarks into a flat numpy array of length 1662."""
    pose = np.array([[res.x, res.y, res.z, res.visibility] for res in results.pose_landmarks.landmark]).flatten() if results.pose_landmarks else np.zeros(33 * 4)
    face = np.array([[res.x, res.y, res.z] for res in results.face_landmarks.landmark]).flatten() if results.face_landmarks else np.zeros(468 * 3)
    lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten() if results.left_hand_landmarks else np.zeros(21 * 3)
    rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten() if results.right_hand_landmarks else np.zeros(21 * 3)
    return np.concatenate([pose, face, lh, rh])

# ========================
# CREATE DIRECTORY STRUCTURE
# ========================

for action in ACTIONS:
    for sequence in range(NUM_SEQUENCES):
        dir_path = os.path.join(DATA_PATH, action, str(sequence))
        os.makedirs(dir_path, exist_ok=True)

print(f"Created directories for {len(ACTIONS)} actions × {NUM_SEQUENCES} sequences")
print(f"Actions: {list(ACTIONS)}")
print(f"\nStarting data collection in 3 seconds...")
print("Press 'q' at any time to quit.\n")
time.sleep(3)

# ========================
# DATA COLLECTION LOOP
# ========================

cap = cv2.VideoCapture(0)

# Set camera resolution (optional, helps with consistency)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
    
    for action in ACTIONS:
        print(f"\n{'='*50}")
        print(f"  RECORDING: {action}")
        print(f"{'='*50}")
        
        for sequence in range(NUM_SEQUENCES):
            # Check if this sequence already has data (resume support)
            check_path = os.path.join(DATA_PATH, action, str(sequence), '0.npy')
            if os.path.exists(check_path):
                print(f"  Sequence {sequence} already exists, skipping...")
                continue
            
            for frame_num in range(SEQUENCE_LENGTH):
                ret, frame = cap.read()
                if not ret:
                    print("ERROR: Cannot read from webcam")
                    break
                
                # Run MediaPipe detection
                image, results = mediapipe_detection(frame, holistic)
                
                # Draw landmarks for visual feedback
                draw_landmarks(image, results)
                
                # Show status on frame
                if frame_num == 0:
                    # Show "GET READY" message at the start of each sequence
                    cv2.putText(image, 'STARTING COLLECTION', (120, 200),
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 4, cv2.LINE_AA)
                    cv2.putText(image, f'Sign: {action} | Seq: {sequence}/{NUM_SEQUENCES}',
                               (15, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1, cv2.LINE_AA)
                    cv2.imshow('SenseAI Data Collection', image)
                    cv2.waitKey(500)  # Half-second pause at start of each sequence
                else:
                    cv2.putText(image, f'Sign: {action} | Seq: {sequence} | Frame: {frame_num}',
                               (15, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1, cv2.LINE_AA)
                    cv2.imshow('SenseAI Data Collection', image)
                
                # Extract and save keypoints
                keypoints = extract_keypoints(results)
                npy_path = os.path.join(DATA_PATH, action, str(sequence), str(frame_num))
                np.save(npy_path, keypoints)
                
                # Check for quit
                if cv2.waitKey(10) & 0xFF == ord('q'):
                    print("\nQuitting data collection...")
                    cap.release()
                    cv2.destroyAllWindows()
                    exit()
            
            print(f"  ✓ Sequence {sequence + 1}/{NUM_SEQUENCES} recorded")
    
    print(f"\n{'='*50}")
    print("  DATA COLLECTION COMPLETE")
    print(f"{'='*50}")

cap.release()
cv2.destroyAllWindows()
```

### Running Data Collection

```powershell
cd senseai\ml
.\venv\Scripts\activate
python collect_data.py
```

**What to expect:**
- A webcam window opens showing you with colored landmarks drawn on your body
- For each sign, you'll perform the sign 30 times
- Each "performance" lasts 30 frames (~1 second)
- There's a brief pause between performances
- Total time: ~15-20 minutes for 10 signs

**Tips for quality data:**
- Sit consistently, about arm's length from camera
- Ensure good lighting on your hands and face
- Wear a plain, non-patterned shirt
- Vary signing speed slightly (some fast, some slow) — this helps the model generalize
- If MediaPipe isn't detecting your hands (no colored dots on hands), adjust lighting or move closer
- You can quit with 'q' and resume later — the script checks for existing data and skips completed sequences

### Verify Data

After collection, verify the data:

```python
# verify_data.py
import os
import numpy as np

DATA_PATH = 'MP_Data'
ACTIONS = ['Hello', 'Thank_You', 'Help', 'Yes', 'No',
           'Please', 'Sorry', 'I_Love_You', 'Stop', 'More']

for action in ACTIONS:
    action_path = os.path.join(DATA_PATH, action)
    num_sequences = len(os.listdir(action_path))
    
    # Check first sequence
    sample = np.load(os.path.join(action_path, '0', '0.npy'))
    
    # Count sequences with hands detected (non-zero hand landmarks)
    hands_detected = 0
    for seq in range(min(num_sequences, 30)):
        frame = np.load(os.path.join(action_path, str(seq), '15.npy'))  # Check middle frame
        # Hand landmarks start at index 132+1404 = 1536
        left_hand = frame[1536:1536+63]
        right_hand = frame[1536+63:1536+126]
        if np.any(left_hand != 0) or np.any(right_hand != 0):
            hands_detected += 1
    
    print(f"{action:15s} | {num_sequences:2d} sequences | shape: {sample.shape} | hands detected: {hands_detected}/{min(num_sequences, 30)}")

print(f"\nExpected shape per frame: (1662,)")
print(f"If hands_detected is low for a sign, re-record that sign with better lighting/positioning.")
```

**If hands_detected is below 20/30 for any sign:** Re-record that sign. Poor hand detection = bad training data = bad model. Fix this BEFORE training.

---

## STEP 2: MODEL TRAINING (Google Colab)

Training happens on Colab because you need a GPU and your Windows machine doesn't have one.

### Upload Data to Colab

**Option A: Google Drive (recommended)**
1. Zip the entire `MP_Data` folder: right-click → Send to → Compressed folder
2. Upload the zip to Google Drive
3. In Colab, mount Drive and unzip

**Option B: Direct upload**
1. Zip `MP_Data`
2. Upload directly to Colab (slower for large files)

### Colab Notebook

Create a new Colab notebook. Set runtime to **GPU**: Runtime → Change runtime type → T4 GPU.

```python
# ============================================================
# CELL 1: Mount Google Drive and extract data
# ============================================================
from google.colab import drive
drive.mount('/content/drive')

# Adjust this path to where you uploaded the zip
!cp /content/drive/MyDrive/MP_Data.zip /content/
!unzip -q /content/MP_Data.zip -d /content/

!ls /content/MP_Data/
# Should show: Hello  Help  I_Love_You  More  No  Please  Sorry  Stop  Thank_You  Yes
```

```python
# ============================================================
# CELL 2: Install and import dependencies
# ============================================================
import numpy as np
import os
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import TensorBoard, EarlyStopping, ModelCheckpoint
from tensorflow.keras.utils import to_categorical
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, classification_report
import matplotlib.pyplot as plt
import seaborn as sns

print("All imports successful")
```

```python
# ============================================================
# CELL 3: Configuration
# ============================================================
DATA_PATH = '/content/MP_Data'

ACTIONS = np.array([
    'Hello', 'Thank_You', 'Help', 'Yes', 'No',
    'Please', 'Sorry', 'I_Love_You', 'Stop', 'More'
])

NUM_SEQUENCES = 30
SEQUENCE_LENGTH = 30

# Create label map
label_map = {label: num for num, label in enumerate(ACTIONS)}
print("Label map:", label_map)
```

```python
# ============================================================
# CELL 4: Load and prepare data
# ============================================================
sequences, labels = [], []
skipped = 0

for action in ACTIONS:
    for sequence in range(NUM_SEQUENCES):
        window = []
        skip_sequence = False
        
        for frame_num in range(SEQUENCE_LENGTH):
            npy_path = os.path.join(DATA_PATH, action, str(sequence), f'{frame_num}.npy')
            
            if not os.path.exists(npy_path):
                skip_sequence = True
                break
            
            res = np.load(npy_path)
            window.append(res)
        
        if skip_sequence:
            skipped += 1
            continue
            
        sequences.append(window)
        labels.append(label_map[action])

X = np.array(sequences)
y = to_categorical(labels).astype(int)

print(f"Data shape: X={X.shape}, y={y.shape}")
print(f"Skipped sequences: {skipped}")
print(f"Expected: X=({len(ACTIONS) * NUM_SEQUENCES}, {SEQUENCE_LENGTH}, 1662)")
# Should be (300, 30, 1662) for 10 actions × 30 sequences
```

```python
# ============================================================
# CELL 5: Train/test split
# ============================================================
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.1, random_state=42, stratify=y
)

print(f"Training: {X_train.shape[0]} sequences")
print(f"Testing:  {X_test.shape[0]} sequences")
```

```python
# ============================================================
# CELL 6: Build the LSTM model
# ============================================================

"""
Architecture notes:
- 3 LSTM layers with decreasing units (64 → 128 → 64)
- tanh activation for LSTM layers (NOT relu — tanh works significantly
  better with LSTMs because it outputs values in [-1, 1] which matches
  LSTM's internal gate structure)
- return_sequences=True for first two LSTMs (pass full sequence to next layer)
- return_sequences=False for last LSTM (output single vector for classification)
- BatchNormalization after each LSTM to stabilize training
- Dropout for regularization (prevents overfitting on small dataset)
- Dense layers for final classification
- softmax output for multi-class probability
"""

model = Sequential([
    # LSTM layer 1: processes full sequence, outputs sequence
    LSTM(64, return_sequences=True, activation='tanh',
         input_shape=(SEQUENCE_LENGTH, 1662)),
    BatchNormalization(),
    Dropout(0.2),
    
    # LSTM layer 2: larger capacity, outputs sequence
    LSTM(128, return_sequences=True, activation='tanh'),
    BatchNormalization(),
    Dropout(0.2),
    
    # LSTM layer 3: outputs single vector (last timestep)
    LSTM(64, return_sequences=False, activation='tanh'),
    BatchNormalization(),
    Dropout(0.2),
    
    # Classification head
    Dense(64, activation='relu'),
    Dense(32, activation='relu'),
    Dense(len(ACTIONS), activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='categorical_crossentropy',
    metrics=['categorical_accuracy']
)

model.summary()
```

```python
# ============================================================
# CELL 7: Train the model
# ============================================================

# Callbacks
early_stop = EarlyStopping(
    monitor='val_categorical_accuracy',
    patience=30,
    restore_best_weights=True,
    verbose=1
)

checkpoint = ModelCheckpoint(
    'best_model.h5',
    monitor='val_categorical_accuracy',
    save_best_only=True,
    verbose=1
)

tb_callback = TensorBoard(log_dir='./logs')

# Train
history = model.fit(
    X_train, y_train,
    epochs=200,
    batch_size=16,
    validation_split=0.15,  # 15% of training data used for validation
    callbacks=[early_stop, checkpoint, tb_callback],
    verbose=1
)

print(f"\nBest validation accuracy: {max(history.history['val_categorical_accuracy']):.4f}")
```

```python
# ============================================================
# CELL 8: Evaluate the model
# ============================================================

# Load best model
from tensorflow.keras.models import load_model
model = load_model('best_model.h5')

# Test set evaluation
loss, accuracy = model.evaluate(X_test, y_test, verbose=0)
print(f"Test accuracy: {accuracy:.4f}")
print(f"Test loss: {loss:.4f}")

# Detailed classification report
y_pred = model.predict(X_test)
y_pred_classes = np.argmax(y_pred, axis=1)
y_true_classes = np.argmax(y_test, axis=1)

print("\nClassification Report:")
print(classification_report(y_true_classes, y_pred_classes, target_names=ACTIONS))

# Confusion matrix
cm = confusion_matrix(y_true_classes, y_pred_classes)
plt.figure(figsize=(12, 10))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=ACTIONS, yticklabels=ACTIONS)
plt.title('Confusion Matrix')
plt.ylabel('True Label')
plt.xlabel('Predicted Label')
plt.tight_layout()
plt.savefig('confusion_matrix.png', dpi=150)
plt.show()
```

```python
# ============================================================
# CELL 9: Training history plots
# ============================================================

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

ax1.plot(history.history['categorical_accuracy'], label='Train')
ax1.plot(history.history['val_categorical_accuracy'], label='Validation')
ax1.set_title('Model Accuracy')
ax1.set_xlabel('Epoch')
ax1.set_ylabel('Accuracy')
ax1.legend()

ax2.plot(history.history['loss'], label='Train')
ax2.plot(history.history['val_loss'], label='Validation')
ax2.set_title('Model Loss')
ax2.set_xlabel('Epoch')
ax2.set_ylabel('Loss')
ax2.legend()

plt.tight_layout()
plt.savefig('training_history.png', dpi=150)
plt.show()
```

```python
# ============================================================
# CELL 10: Save and download the model
# ============================================================

# Save final model
model.save('action_model.h5')

# Also save as SavedModel format (backup)
model.save('action_model_savedmodel')

# Save the actions list for inference
np.save('actions.npy', ACTIONS)

# Copy to Google Drive for safekeeping
!cp action_model.h5 /content/drive/MyDrive/
!cp actions.npy /content/drive/MyDrive/
!cp confusion_matrix.png /content/drive/MyDrive/
!cp training_history.png /content/drive/MyDrive/

# Download to local machine
from google.colab import files
files.download('action_model.h5')
files.download('actions.npy')
files.download('confusion_matrix.png')

print("✅ Model saved and ready for download")
```

### What to Do If Accuracy Is Low (<90%)

| Problem | Solution |
|---------|----------|
| <80% overall | Reduce to 5-7 most distinct signs. Remove signs that confuse each other (check confusion matrix) |
| Two signs always confused | Those signs look too similar. Re-record one of them with more exaggerated movement, or replace it |
| High train accuracy, low test accuracy (>15% gap) | Overfitting. Increase Dropout to 0.3, reduce epochs, or collect more data |
| Low train AND test accuracy | Data quality issue. Check that hands were actually detected during collection. Re-run `verify_data.py` |
| Model predicts one class for everything | Class imbalance or bad data. Ensure all classes have exactly 30 sequences |

### If You Need to Retrain

The fastest iteration cycle:
1. Identify the problematic signs from the confusion matrix
2. Re-record ONLY those signs locally (the script skips existing data, so delete the bad sign's folder first)
3. Re-zip and re-upload to Colab
4. Re-run the training notebook

---

## STEP 3: REAL-TIME INFERENCE (Local, Windows)

Download `action_model.h5` from Colab and place it in `ml/models/`.

Create `ml/test_realtime.py`:

```python
"""
SenseAI — Real-Time Sign Language Detection
=============================================
Runs sign detection on local webcam to verify the model works before
integrating with the backend WebSocket server.

Usage:
    python test_realtime.py

Controls:
    - Press 'q' to quit
"""

import cv2
import numpy as np
import mediapipe as mp
from tensorflow.keras.models import load_model
from collections import deque

# ========================
# CONFIGURATION
# ========================

ACTIONS = np.array([
    'Hello', 'Thank_You', 'Help', 'Yes', 'No',
    'Please', 'Sorry', 'I_Love_You', 'Stop', 'More'
])

SEQUENCE_LENGTH = 30
CONFIDENCE_THRESHOLD = 0.7   # Only show predictions above this confidence
STABILITY_FRAMES = 8         # Require N consecutive same predictions before showing

MODEL_PATH = 'models/action_model.h5'

# ========================
# SETUP
# ========================

mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils

def mediapipe_detection(image, model):
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image.flags.writeable = False
    results = model.process(image)
    image.flags.writeable = True
    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    return image, results

def draw_landmarks(image, results):
    if results.face_landmarks:
        mp_drawing.draw_landmarks(image, results.face_landmarks, mp_holistic.FACEMESH_CONTOURS,
            mp_drawing.DrawingSpec(color=(80,110,10), thickness=1, circle_radius=1),
            mp_drawing.DrawingSpec(color=(80,256,121), thickness=1, circle_radius=1))
    if results.pose_landmarks:
        mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_holistic.POSE_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(80,22,10), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(80,44,121), thickness=2, circle_radius=2))
    if results.left_hand_landmarks:
        mp_drawing.draw_landmarks(image, results.left_hand_landmarks, mp_holistic.HAND_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(121,22,76), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(121,44,250), thickness=2, circle_radius=2))
    if results.right_hand_landmarks:
        mp_drawing.draw_landmarks(image, results.right_hand_landmarks, mp_holistic.HAND_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2))

def extract_keypoints(results):
    pose = np.array([[res.x, res.y, res.z, res.visibility] for res in results.pose_landmarks.landmark]).flatten() if results.pose_landmarks else np.zeros(33*4)
    face = np.array([[res.x, res.y, res.z] for res in results.face_landmarks.landmark]).flatten() if results.face_landmarks else np.zeros(468*3)
    lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten() if results.left_hand_landmarks else np.zeros(21*3)
    rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten() if results.right_hand_landmarks else np.zeros(21*3)
    return np.concatenate([pose, face, lh, rh])

# ========================
# LOAD MODEL
# ========================

print(f"Loading model from {MODEL_PATH}...")
model = load_model(MODEL_PATH)
print(f"Model loaded. Input shape: {model.input_shape}")
print(f"Actions: {list(ACTIONS)}")

# ========================
# INFERENCE LOOP
# ========================

# Sliding window buffer of keypoint frames
sequence = deque(maxlen=SEQUENCE_LENGTH)

# Stability tracking
recent_predictions = deque(maxlen=STABILITY_FRAMES)
current_sign = ""
current_confidence = 0.0

# For display
sentence = []  # History of detected signs
colors = [
    (245,117,16), (117,245,16), (16,117,245), (245,16,117), (16,245,117),
    (117,16,245), (200,200,16), (16,200,200), (200,16,200), (128,128,128)
]

cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

print("\nStarting real-time detection. Press 'q' to quit.\n")

with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        # Run MediaPipe
        image, results = mediapipe_detection(frame, holistic)
        draw_landmarks(image, results)
        
        # Extract keypoints and add to buffer
        keypoints = extract_keypoints(results)
        sequence.append(keypoints)
        
        # Only predict when we have a full sequence
        if len(sequence) == SEQUENCE_LENGTH:
            input_data = np.expand_dims(list(sequence), axis=0)
            prediction = model.predict(input_data, verbose=0)[0]
            predicted_idx = np.argmax(prediction)
            confidence = prediction[predicted_idx]
            
            # Stability check: require N consecutive same predictions
            recent_predictions.append(predicted_idx)
            
            if (confidence > CONFIDENCE_THRESHOLD and 
                len(recent_predictions) == STABILITY_FRAMES and
                len(set(recent_predictions)) == 1):
                
                new_sign = ACTIONS[predicted_idx]
                
                # Only add to sentence if it's different from the last sign
                if new_sign != current_sign:
                    current_sign = new_sign
                    current_confidence = confidence
                    sentence.append(new_sign)
                    print(f"  Detected: {new_sign} ({confidence:.2f})")
                    
                    # Keep sentence manageable
                    if len(sentence) > 5:
                        sentence = sentence[-5:]
            
            # Draw probability bars
            for i, (action, prob) in enumerate(zip(ACTIONS, prediction)):
                bar_width = int(prob * 200)
                color = colors[i % len(colors)]
                cv2.rectangle(image, (0, 60 + i*30), (bar_width, 80 + i*30), color, -1)
                cv2.putText(image, f'{action}: {prob:.2f}', (0, 75 + i*30),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1)
        
        # Draw current detection
        cv2.rectangle(image, (0, 0), (640, 40), (245, 117, 16), -1)
        cv2.putText(image, ' | '.join(sentence), (5, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
        
        cv2.imshow('SenseAI — Real-Time Sign Detection', image)
        
        if cv2.waitKey(10) & 0xFF == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()
print("\nDetection stopped.")
```

### Tuning Parameters

If the real-time detection feels wrong, adjust these:

| Parameter | Default | If too many false positives | If too many missed signs |
|-----------|---------|---------------------------|------------------------|
| `CONFIDENCE_THRESHOLD` | 0.7 | Increase to 0.85 | Decrease to 0.5 |
| `STABILITY_FRAMES` | 8 | Increase to 12 | Decrease to 5 |

---

## STEP 4: WEBSOCKET SERVER FOR FRONTEND INTEGRATION

This is the bridge between your ML pipeline and the browser. The frontend sends video frames via WebSocket, your server runs MediaPipe + LSTM, and returns predictions.

Create `ml/ws_server.py`:

```python
"""
SenseAI — Sign Detection WebSocket Server
==========================================
Receives base64-encoded video frames from the browser frontend,
runs MediaPipe Holistic + LSTM inference, and returns sign predictions.

This runs as part of the FastAPI backend. The backend lead will import
this or run it as a separate service.

Usage:
    uvicorn ws_server:app --host 0.0.0.0 --port 8001 --reload
"""

import asyncio
import base64
import json
import time
from collections import deque

import cv2
import numpy as np
import mediapipe as mp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from tensorflow.keras.models import load_model

# ========================
# CONFIGURATION
# ========================

ACTIONS = np.array([
    'Hello', 'Thank_You', 'Help', 'Yes', 'No',
    'Please', 'Sorry', 'I_Love_You', 'Stop', 'More'
])

SEQUENCE_LENGTH = 30
CONFIDENCE_THRESHOLD = 0.7
STABILITY_FRAMES = 8
MODEL_PATH = 'models/action_model.h5'

# ========================
# APP SETUP
# ========================

app = FastAPI(title="SenseAI Sign Detection")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model at startup (not per-connection)
print(f"Loading LSTM model from {MODEL_PATH}...")
model = load_model(MODEL_PATH)
print(f"✅ Model loaded. Actions: {list(ACTIONS)}")

# MediaPipe Holistic setup
mp_holistic = mp.solutions.holistic

def extract_keypoints(results):
    pose = np.array([[res.x, res.y, res.z, res.visibility] for res in results.pose_landmarks.landmark]).flatten() if results.pose_landmarks else np.zeros(33*4)
    face = np.array([[res.x, res.y, res.z] for res in results.face_landmarks.landmark]).flatten() if results.face_landmarks else np.zeros(468*3)
    lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten() if results.left_hand_landmarks else np.zeros(21*3)
    rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten() if results.right_hand_landmarks else np.zeros(21*3)
    return np.concatenate([pose, face, lh, rh])

def decode_frame(base64_string: str) -> np.ndarray:
    """Decode a base64-encoded image string into an OpenCV frame."""
    # Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    img_bytes = base64.b64decode(base64_string)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    return frame

# ========================
# HEALTH CHECK
# ========================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "actions": list(ACTIONS),
        "sequence_length": SEQUENCE_LENGTH,
    }

# ========================
# WEBSOCKET ENDPOINT
# ========================

@app.websocket("/ws/sign-detection")
async def sign_detection(websocket: WebSocket):
    await websocket.accept()
    print(f"Client connected: {websocket.client}")
    
    # Per-connection state
    sequence = deque(maxlen=SEQUENCE_LENGTH)
    recent_predictions = deque(maxlen=STABILITY_FRAMES)
    current_sign = ""
    frames_processed = 0
    
    # Create a MediaPipe Holistic instance per connection
    holistic = mp_holistic.Holistic(
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    
    try:
        while True:
            # Receive frame from frontend
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") != "frame":
                continue
            
            base64_frame = message.get("frame", "")
            if not base64_frame:
                continue
            
            # Decode frame
            try:
                frame = decode_frame(base64_frame)
            except Exception as e:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Frame decode error: {str(e)}"
                })
                continue
            
            # Run MediaPipe
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image_rgb.flags.writeable = False
            results = holistic.process(image_rgb)
            
            # Extract keypoints
            keypoints = extract_keypoints(results)
            sequence.append(keypoints)
            frames_processed += 1
            
            # Send hand detection status (useful for frontend UI feedback)
            hands_detected = (results.left_hand_landmarks is not None or
                            results.right_hand_landmarks is not None)
            
            # Only predict when we have a full sequence
            if len(sequence) == SEQUENCE_LENGTH:
                input_data = np.expand_dims(list(sequence), axis=0)
                prediction = model.predict(input_data, verbose=0)[0]
                predicted_idx = int(np.argmax(prediction))
                confidence = float(prediction[predicted_idx])
                
                # Stability check
                recent_predictions.append(predicted_idx)
                
                stable = (len(recent_predictions) == STABILITY_FRAMES and
                         len(set(recent_predictions)) == 1)
                
                is_new_sign = False
                if stable and confidence > CONFIDENCE_THRESHOLD:
                    new_sign = ACTIONS[predicted_idx]
                    if new_sign != current_sign:
                        current_sign = new_sign
                        is_new_sign = True
                        print(f"  Sign detected: {new_sign} ({confidence:.2f})")
                
                # Send prediction to frontend
                await websocket.send_json({
                    "type": "sign_prediction",
                    "sign": ACTIONS[predicted_idx],
                    "confidence": round(confidence, 3),
                    "is_stable": stable,
                    "is_new_sign": is_new_sign,
                    "hands_detected": hands_detected,
                    "all_predictions": {
                        ACTIONS[i]: round(float(prediction[i]), 3)
                        for i in range(len(ACTIONS))
                    },
                    "frames_processed": frames_processed,
                })
            else:
                # Not enough frames yet, send status only
                await websocket.send_json({
                    "type": "buffering",
                    "frames_collected": len(sequence),
                    "frames_needed": SEQUENCE_LENGTH,
                    "hands_detected": hands_detected,
                })
    
    except WebSocketDisconnect:
        print(f"Client disconnected: {websocket.client}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        holistic.close()
        print(f"Connection cleaned up. Processed {frames_processed} frames.")
```

### Frontend Integration Protocol

Tell the frontend team (Frontend 2) that they need to:

**1. Capture frames from the local video element:**
```javascript
// In the browser, capture frames from the webcam video element
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function captureFrame(videoElement) {
    canvas.width = 640;  // Match backend expectations
    canvas.height = 480;
    ctx.drawImage(videoElement, 0, 0, 640, 480);
    return canvas.toDataURL('image/jpeg', 0.7);  // base64 JPEG, 70% quality
}
```

**2. Send frames via WebSocket at ~10 FPS:**
```javascript
const ws = new WebSocket('ws://localhost:8001/ws/sign-detection');

// Send frames at 10 FPS (every 100ms)
setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
        const frame = captureFrame(localVideoElement);
        ws.send(JSON.stringify({
            type: 'frame',
            frame: frame
        }));
    }
}, 100);
```

**3. Handle responses:**
```javascript
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'sign_prediction' && data.is_new_sign) {
        // New sign detected! Display it and/or trigger TTS
        console.log(`Sign: ${data.sign} (${data.confidence})`);
        displaySign(data.sign);
        speakSign(data.sign);  // TTS
    }
    
    if (data.type === 'buffering') {
        // Show loading indicator
        showBuffering(data.frames_collected, data.frames_needed);
    }
    
    // Show hand detection feedback
    updateHandIndicator(data.hands_detected);
};
```

### Running the Server

```powershell
cd senseai\ml
.\venv\Scripts\activate
uvicorn ws_server:app --host 0.0.0.0 --port 8001 --reload
```

Test the health check: open `http://localhost:8001/health` in a browser.

### Integration with Main Backend

The backend lead has two options for integrating your sign detection server:

**Option A: Separate service (simpler)**
- Your server runs on port 8001
- Main FastAPI backend runs on port 8000
- Frontend connects to both

**Option B: Import into main backend (cleaner)**
- Backend lead imports your WebSocket endpoint into their FastAPI app
- Everything runs on one port
- Coordinate with backend lead on this — they may prefer Option A for the hackathon

---

## STEP 5: PERFORMANCE OPTIMIZATION

### Frame Rate Management

The bottleneck is MediaPipe Holistic processing. On a CPU (your Windows machine), expect:
- ~15-25 FPS for MediaPipe Holistic alone
- ~10-15 FPS with LSTM inference added
- The frontend sends at 10 FPS, which is the right balance

If inference is too slow, in order of impact:

1. **Reduce frame sending rate to 5 FPS** (change interval to 200ms in frontend)
2. **Skip face landmarks**: Change `extract_keypoints` to return 258 features instead of 1662. This requires retraining the model (fast — just re-run Colab notebook) but makes inference 2-3x faster
3. **Resize frames before sending**: Frontend sends 320×240 instead of 640×480
4. **Use MediaPipe Hands + Pose separately** instead of Holistic (more control over what's processed)

### Memory Management

Each WebSocket connection holds:
- One MediaPipe Holistic instance (~50-100MB)
- One sliding window buffer (30 × 1662 floats ≈ 200KB)

For a hackathon demo with 1-2 simultaneous connections, this is fine. Don't optimize prematurely.

---

## STEP 6: COMMON ISSUES AND FIXES

| Issue | Cause | Fix |
|-------|-------|-----|
| `ModuleNotFoundError: No module named 'mediapipe'` | Wrong Python version or venv not activated | Activate venv: `.\venv\Scripts\activate`. Check `python --version` is 3.9-3.11 |
| Webcam shows black screen in OpenCV | Another app using the camera | Close other apps (Zoom, Teams, browser tabs with camera access) |
| MediaPipe detects pose but not hands | Hands are out of frame or poorly lit | Move hands into center of frame, improve lighting, face camera directly |
| `cv2.error: (-215:Assertion failed)` in imdecode | Corrupted base64 frame from frontend | Ensure frontend sends JPEG base64 with proper prefix. Log and skip bad frames |
| Model always predicts same class | Training data issue or overfitting | Check confusion matrix. Re-collect data for confused classes |
| WebSocket connection drops frequently | Large frames, slow network | Reduce JPEG quality to 0.5, reduce resolution, add reconnection logic in frontend |
| `OOM (Out of Memory)` during training on Colab | Batch size too large or model too big | Reduce batch_size to 8. Free Colab has limited RAM |
| TensorFlow warnings about GPU on Windows | TF looking for CUDA on Windows | Ignore these warnings. CPU inference is fast enough for 10-class LSTM. Add `os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'` to suppress |

---

## TIMELINE CHECKLIST

Use this to track your progress. If you fall behind, flag it to the team immediately.

```
HOUR 0-2:   [ ] Environment setup verified (test_setup.py passes)
            [ ] Project structure created
            [ ] Webcam working with MediaPipe visualization

HOUR 2-4:   [ ] collect_data.py working
            [ ] First 2 signs recorded successfully
            [ ] Keypoints verified (verify_data.py)

HOUR 4-8:   [ ] All 10 signs recorded (30 sequences × 30 frames each)
            [ ] Data verified — hands detected in >80% of frames per sign
            [ ] Data zipped and uploaded to Google Drive

HOUR 8-10:  [ ] Colab notebook running
            [ ] Model trained to >90% test accuracy
            [ ] Confusion matrix reviewed — no major confusions
            [ ] action_model.h5 downloaded to Windows machine

HOUR 10-12: [ ] test_realtime.py working
            [ ] Signs detected reliably on webcam
            [ ] Confidence threshold tuned (few false positives)

HOUR 12-16: [ ] ws_server.py running on localhost:8001
            [ ] /health endpoint returns correct response
            [ ] WebSocket accepts connections
            [ ] PAIR WITH BACKEND LEAD: integrate or coordinate ports

HOUR 16-20: [ ] Frontend team can send frames and receive predictions
            [ ] End-to-end test: sign on webcam → text appears in browser
            [ ] Latency is acceptable (<500ms from sign to prediction)

HOUR 20-24: [ ] Idle detection working (no hallucinated signs when hands are resting)
            [ ] Stability smoothing working (no flickering between signs)
            [ ] Edge cases handled (no hands visible, poor lighting)

HOUR 24-30: [ ] If accuracy allows: expand to 15 signs (Pain, Water, Eat, Sleep, Bathroom)
            [ ] If accuracy issues: polish existing 10 signs with more data

HOUR 30-36: [ ] Help frontend team debug sign detection UI
            [ ] Help record demo video segments
            [ ] Final model saved and backed up

HOUR 36-48: [ ] Feature freeze — no more model changes
            [ ] Help with demo video recording
            [ ] Ensure server runs stably for recording session
```

---

## FILE MANIFEST

When you're done, your `ml/` directory should contain:

```
ml/
├── venv/                       ← Python virtual environment (not committed to git)
├── MP_Data/                    ← Raw keypoint data (can be large, .gitignore this)
│   ├── Hello/
│   │   ├── 0/ ... 29/         ← 30 sequences, each with 30 .npy files
│   ├── Thank_You/ ...
│   └── More/ ...
├── models/
│   └── action_model.h5        ← Trained LSTM model (~5-15 MB)
├── collect_data.py             ← Data collection script
├── verify_data.py              ← Data verification script
├── test_realtime.py            ← Standalone real-time inference test
├── ws_server.py                ← WebSocket server for frontend integration
├── test_setup.py               ← Environment verification script
├── actions.npy                 ← Numpy array of action labels
├── requirements.txt            ← pip dependencies
├── training_notebook.ipynb     ← Copy of Colab notebook (for reference)
├── confusion_matrix.png        ← Model evaluation visualization
└── CLAUDE.md                   ← This file
```

### requirements.txt

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

---

## COMMUNICATION WITH OTHER TEAM MEMBERS

### To Backend Lead:
- "My WebSocket server runs on port 8001. Endpoint: `/ws/sign-detection`. Health check: `GET /health`"
- "Message format: frontend sends `{type: 'frame', frame: '<base64 jpeg>'}`, I return `{type: 'sign_prediction', sign: 'Hello', confidence: 0.95, is_new_sign: true, hands_detected: true}`"
- "Either you proxy my WebSocket through your main server, or frontend connects to me directly on a separate port"

### To Frontend 2 (Video Call):
- "Capture frames from the local `<video>` element using canvas at 640×480, JPEG quality 0.7"
- "Send frames at 10 FPS (100ms interval) via WebSocket"
- "When you receive `is_new_sign: true`, display the `sign` field and trigger TTS"
- "When you receive `hands_detected: false`, show a UI hint like 'Position hands in frame'"
- "The `buffering` message type means I'm still collecting the first 30 frames — show a loading indicator"

### To Frontend 1 (App Shell):
- "No direct interaction needed. Just make sure the Video Call mode has a way to connect to my WebSocket server"
