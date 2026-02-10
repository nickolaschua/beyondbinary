# Agent 3: Model Training (Phase 6)

## Working Directory
```
C:\Users\nicko\Desktop\beyondbinary\worktrees\agent-3-model-training
```

## Branch
`agent/model-training`

## Mission
Create the complete Google Colab training notebook and a local training script. The notebook takes recorded keypoint data, trains a 3-layer LSTM classifier, evaluates it, and exports `action_model.h5`. This is the brain of the entire pipeline.

## Dependencies
You depend on the DATA FORMAT from Agent 1/2, but you do NOT import their code. The Colab notebook is self-contained.

### Data Contract
```
MP_Data/
├── Hello/
│   ├── 0/          (30 .npy files: 0.npy through 29.npy)
│   ├── 1/
│   └── ... 29/
├── Thank_You/
├── Help/
├── Yes/
├── No/
├── Please/
├── Sorry/
├── I_Love_You/
├── Stop/
└── More/

Each .npy file: numpy array of shape (1662,)
- Indices 0-131: pose (33 × 4)
- Indices 132-1535: face (468 × 3)
- Indices 1536-1598: left hand (21 × 3)
- Indices 1599-1661: right hand (21 × 3)
```

## What You Deliver

### 1. `ml/train_model.py` (Local training script — backup option)

A standalone Python script that can train the model locally (slower, CPU only). Same architecture as the Colab notebook but runs on Windows without GPU.

### 2. `ml/training_notebook.ipynb` (Google Colab notebook — primary)

A Jupyter notebook with 10 cells, designed to run on Colab with T4 GPU.

**Cell 1: Mount Google Drive + Extract Data**
```python
from google.colab import drive
drive.mount('/content/drive')
!cp /content/drive/MyDrive/MP_Data.zip /content/
!unzip -q /content/MP_Data.zip -d /content/
!ls /content/MP_Data/
```

**Cell 2: Imports**
```python
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
```

**Cell 3: Configuration**
```python
DATA_PATH = '/content/MP_Data'
ACTIONS = np.array([
    'Hello', 'Thank_You', 'Help', 'Yes', 'No',
    'Please', 'Sorry', 'I_Love_You', 'Stop', 'More'
])
NUM_SEQUENCES = 30
SEQUENCE_LENGTH = 30
label_map = {label: num for num, label in enumerate(ACTIONS)}
```

**Cell 4: Load and Prepare Data**
- Loop through actions → sequences → frames
- Load each .npy file into a window list
- Skip missing sequences (log count)
- Build X array: shape `(300, 30, 1662)` — 10 actions × 30 sequences
- Build y array: one-hot encoded labels
- Print shapes and any skipped sequences

**Cell 5: Train/Test Split**
```python
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.1, random_state=42, stratify=y
)
```
- 90/10 split with stratification
- Print counts

**Cell 6: Build LSTM Model**

CRITICAL ARCHITECTURE — do not deviate:
```python
model = Sequential([
    LSTM(64, return_sequences=True, activation='tanh', input_shape=(30, 1662)),
    BatchNormalization(),
    Dropout(0.2),

    LSTM(128, return_sequences=True, activation='tanh'),
    BatchNormalization(),
    Dropout(0.2),

    LSTM(64, return_sequences=False, activation='tanh'),
    BatchNormalization(),
    Dropout(0.2),

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

Key differences from reference repos:
- **tanh** activation for LSTM (NOT relu)
- **BatchNormalization** after each LSTM layer
- **Dropout(0.2)** for regularization

**Cell 7: Train**
```python
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

history = model.fit(
    X_train, y_train,
    epochs=200,
    batch_size=16,
    validation_split=0.15,
    callbacks=[early_stop, checkpoint, tb_callback],
    verbose=1
)
```
- 200 epochs max with early stopping (patience=30)
- 15% validation split from training data
- Batch size 16
- Print best validation accuracy

**Cell 8: Evaluate**
- Load best model from checkpoint
- Evaluate on X_test (NOT X_train — SomyanshAvasthi's bug)
- Print test accuracy and loss
- Classification report with per-class precision/recall/F1
- Confusion matrix heatmap (save as `confusion_matrix.png`)

**Cell 9: Training History Plots**
- Accuracy plot (train vs validation)
- Loss plot (train vs validation)
- Save as `training_history.png`

**Cell 10: Save and Download**
```python
model.save('action_model.h5')
model.save('action_model_savedmodel')
np.save('actions.npy', ACTIONS)

# Copy to Google Drive
!cp action_model.h5 /content/drive/MyDrive/
!cp actions.npy /content/drive/MyDrive/
!cp confusion_matrix.png /content/drive/MyDrive/

# Download
from google.colab import files
files.download('action_model.h5')
files.download('actions.npy')
files.download('confusion_matrix.png')
```

### 3. `ml/troubleshooting_training.md`

A quick reference for common training issues:

| Problem | Solution |
|---------|----------|
| <80% accuracy | Reduce to 5-7 most distinct signs, check confusion matrix |
| Two signs always confused | Re-record one with more exaggerated movement |
| High train, low test (>15% gap) | Increase Dropout to 0.3, reduce epochs |
| Low train AND test | Data quality issue — re-run verify_data.py |
| Predicts one class for everything | Class imbalance or bad data |
| OOM on Colab | Reduce batch_size to 8 |

## Technical Constraints

- **Activation**: LSTM layers MUST use `tanh` — not relu. This is a hard requirement.
- **Keypoint order**: Model expects `[pose, face, lh, rh]` = 1662 features. Do NOT reorder.
- **Evaluation**: Evaluate on `X_test`, NOT `X_train`.
- **Save format**: `.h5` (HDF5) for the primary model — this is what the inference scripts load.
- **Colab runtime**: T4 GPU. Training should complete in <10 minutes for 300 sequences.

## Verification

Before committing, verify:
- [ ] `train_model.py` runs without syntax errors (can't fully test without data)
- [ ] `training_notebook.ipynb` is valid JSON (well-formed notebook)
- [ ] Model architecture matches spec: 3 LSTM (tanh) + BatchNorm + Dropout + 3 Dense
- [ ] Data loading uses correct path structure and handles missing sequences
- [ ] Evaluation is on X_test not X_train
- [ ] Confusion matrix and training history plots are generated
- [ ] Model saved as `action_model.h5`

## Git

```bash
cd C:\Users\nicko\Desktop\beyondbinary\worktrees\agent-3-model-training
# When done:
git add ml/train_model.py ml/training_notebook.ipynb ml/troubleshooting_training.md
git commit -m "feat(06): model training - LSTM notebook and local training script

- training_notebook.ipynb: 10-cell Colab notebook with T4 GPU support
- train_model.py: local CPU training fallback
- 3-layer LSTM (tanh), BatchNorm, Dropout, EarlyStopping
- Confusion matrix and training history visualization

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

## IMPORTANT
- Do NOT create utils.py, collect_data.py, or verify_data.py (Agents 1-2)
- Do NOT create WebSocket server or inference scripts (Agent 4)
- Do NOT import from utils.py in the Colab notebook — it must be self-contained
- The train_model.py local script CAN import from utils.py for constants
- Your ONLY job is the training pipeline
