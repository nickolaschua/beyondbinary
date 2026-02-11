# SenseAI ML Upgrade — Technical Specification

## Decision

Expand from 10 self-recorded ASL signs to **50+ signs using the WLASL dataset**, upgrade the LSTM to a **lightweight Transformer**, and add **naive sentence assembly** via the existing stability filter. All within a **30-hour budget**.

This document is the single source of truth for implementation. All code changes reference sections here.

---

## Current State (Baseline)

| Attribute | Value |
|-----------|-------|
| Signs | 10 (Hello, Thank_You, Help, Yes, No, Please, Sorry, I_Love_You, Stop, More) |
| Architecture | 3-layer LSTM (64→128→64), BatchNorm, Dropout(0.2) |
| Input shape | (batch, 30, 1662) — 30 frames, 1662 keypoint features |
| Output | Softmax over 10 classes |
| Data | Self-recorded via webcam, 30 sequences × 30 frames per sign |
| Trained model | None yet (pipeline complete, no data recorded) |
| Server | FastAPI WebSocket on port 8001, `/ws/sign-detection` |
| Keypoint format | `[pose(132), face(1404), left_hand(63), right_hand(63)]` = 1662 |

### Files That Will Change

| File | Change |
|------|--------|
| `ml/utils.py` | Expand ACTIONS array to 50+ signs |
| `ml/train_model.py` | Update Dense output layer (auto from `len(ACTIONS)`), add Transformer option |
| `ml/ws_server.py` | Add sentence buffer, new `sentence_update` message type |
| `ml/verify_data.py` | Support dynamic action list (not hardcoded 10) |
| `ml/training_notebook.ipynb` | Update for 50+ signs + Transformer architecture |

### New Files

| File | Purpose |
|------|---------|
| `ml/import_wlasl.py` | Download/process WLASL videos → MP_Data format |
| `ml/transformer_model.py` | Lightweight Transformer encoder (optional, Phase 3) |

---

## Phase 1: Get Baseline Working (Hours 1-4)

### Goal
Record data for 10 signs, train a model, confirm the full pipeline works end-to-end.

### Steps

1. **Record data** — both team members run `collect_data.py`
   ```bash
   cd ml
   python collect_data.py
   ```
   - 10 signs × 30 sequences × 30 frames = 9,000 frames
   - ~10 minutes per person including pauses
   - Vary: lighting, angle, distance, hand speed between sequences

2. **Verify data quality**
   ```bash
   python verify_data.py
   ```
   - Must pass: ≥15/30 sequences with hand detection per sign
   - Warning at <20/30

3. **Train on Colab**
   - Upload `MP_Data/` as zip to Google Drive
   - Run `training_notebook.ipynb` on T4 GPU
   - Target: >90% test accuracy on 10 classes
   - Download `action_model.h5` → `ml/models/`

4. **Test WebSocket server**
   ```bash
   python ws_server.py
   ```
   - Hit `/health` — confirm `model_loaded: true`
   - Send test frames via WebSocket — confirm predictions return

### Exit Criteria
- Model file exists at `ml/models/action_model.h5`
- `/health` returns `model_loaded: true` with 10 actions
- WebSocket returns `sign_prediction` messages with reasonable confidence

---

## Phase 2: Scale Vocabulary with WLASL (Hours 5-12)

### Goal
Expand from 10 to 50+ signs using the WLASL public dataset, processed through MediaPipe into the existing data format.

### 2.1 Data Source

**WLASL (Word-Level American Sign Language)**
- Source: Kaggle pre-processed dataset (5.18 GB, ~12,000 videos)
- URL: https://www.kaggle.com/datasets/risangbaskoro/wlasl-processed
- Metadata: `WLASL_v0.3.json` maps video_id → gloss → signer
- License: Computational Use of Data Agreement (C-UDA) — academic/non-commercial only
- Videos named by `video_id` (e.g., `06029.mp4`)

**Why Kaggle over GitHub downloader:** Pre-downloaded videos, no dead YouTube links, single zip file.

### 2.2 Target Vocabulary (50 Signs)

Criteria for sign selection:
- Useful for real communication (greetings, needs, emotions, common words)
- Exists in WLASL with ≥10 video instances
- Visually distinct from other selected signs (reduce confusion)

**Proposed 50-sign vocabulary:**

```python
ACTIONS = np.array([
    # Original 10
    'Hello', 'Thank_You', 'Help', 'Yes', 'No',
    'Please', 'Sorry', 'I_Love_You', 'Stop', 'More',
    # Needs & Actions (10)
    'Want', 'Need', 'Like', 'Eat', 'Drink',
    'Go', 'Come', 'Give', 'Take', 'Make',
    # Questions & Communication (10)
    'What', 'Where', 'When', 'Who', 'Why',
    'How', 'Name', 'Understand', 'Know', 'Think',
    # Descriptions (10)
    'Good', 'Bad', 'Happy', 'Sad', 'Big',
    'Small', 'Hot', 'Cold', 'New', 'Old',
    # Social (10)
    'Friend', 'Family', 'Home', 'School', 'Work',
    'Day', 'Night', 'Water', 'Food', 'Money',
])
```

**IMPORTANT:** This list must be validated against WLASL glosses. Some may not exist or may have different spellings. Step 1 of `import_wlasl.py` will print available matches and let us adjust.

### 2.3 WLASL Gloss Mapping

WLASL uses lowercase glosses, sometimes with spaces. Mapping required:

```python
# In import_wlasl.py
GLOSS_MAPPING = {
    # Our action name → WLASL gloss (lowercase)
    'Hello': 'hello',
    'Thank_You': 'thank you',
    'Help': 'help',
    'Yes': 'yes',
    'No': 'no',
    'Please': 'please',
    'Sorry': 'sorry',
    'I_Love_You': 'i love you',
    'Stop': 'stop',
    'More': 'more',
    'Want': 'want',
    'Need': 'need',
    # ... etc.
    # Filled in after parsing WLASL_v0.3.json
}
```

**Step 1 of implementation:** Parse the JSON, print all 2000 glosses, manually pick the best 40 additions to our base 10.

### 2.4 WLASL JSON Structure

```json
[
  {
    "gloss": "hello",
    "instances": [
      {
        "video_id": "06029",
        "signer_id": 3,
        "fps": 25,
        "frame_start": 1,
        "frame_end": 78,
        "split": "train",
        "source": "aslpro",
        "url": "..."
      }
    ]
  }
]
```

Key fields:
- `gloss`: The sign word (lowercase)
- `video_id`: Maps to `{video_id}.mp4` in the downloaded dataset
- `fps`: Usually 25
- `frame_start` / `frame_end`: Temporal boundaries of the sign within the video
- `signer_id`: Different person performing the sign (diversity!)
- `split`: train/test/val assignment from original paper

### 2.5 Video → Keypoint Extraction Pipeline

```
WLASL video (MP4)
  → OpenCV VideoCapture → BGR frames
  → Crop to frame_start:frame_end (use JSON metadata)
  → MediaPipe Holistic per frame → landmarks
  → extract_keypoints() → 1662-dim array per frame
  → Sliding window (30 frames, stride 15) → sequences
  → Quality filter (≥10/30 frames with hand detection)
  → Save as MP_Data/{action}/{seq_idx}/{frame_num}.npy
```

### 2.6 Handling Variable Video Lengths

WLASL videos range from ~15 to 200+ frames. Our pipeline needs exactly 30 frames per sequence.

| Video Length | Strategy |
|--------------|----------|
| < 30 frames | Pad: repeat last keypoint frame to reach 30 |
| 30-44 frames | Single sequence: uniformly sample 30 frames |
| 45-59 frames | Sliding window: 1 sequence (stride=15 gives 2nd too short) |
| 60+ frames | Sliding window: stride=15, extract multiple sequences |

```python
def extract_sequences(keypoints_list, seq_length=30, stride=15):
    """
    Extract fixed-length sequences from variable-length keypoint list.

    Args:
        keypoints_list: List of (1662,) arrays, one per video frame
        seq_length: Target sequence length (30)
        stride: Sliding window stride (15 = 50% overlap)

    Returns:
        List of sequences, each is a list of seq_length (1662,) arrays
    """
    n_frames = len(keypoints_list)

    if n_frames == 0:
        return []

    if n_frames < seq_length:
        # Pad by repeating last frame
        padded = keypoints_list + [keypoints_list[-1]] * (seq_length - n_frames)
        return [padded]

    if n_frames < seq_length + stride:
        # Not enough for sliding window, take one centered sequence
        start = (n_frames - seq_length) // 2
        return [keypoints_list[start:start + seq_length]]

    # Sliding window
    sequences = []
    for start in range(0, n_frames - seq_length + 1, stride):
        sequences.append(keypoints_list[start:start + seq_length])

    return sequences
```

### 2.7 Quality Filter

Drop sequences where hands are detected in fewer than 10 of 30 frames:

```python
def has_enough_hands(sequence, min_hand_frames=10):
    """
    Check that at least min_hand_frames in the sequence have hand landmarks.

    Keypoint layout: [pose(132), face(1404), left_hand(63), right_hand(63)]
    Left hand: indices 1536:1599
    Right hand: indices 1599:1662
    """
    hand_count = 0
    for kp in sequence:
        lh = kp[1536:1599]
        rh = kp[1599:1662]
        if np.any(lh != 0) or np.any(rh != 0):
            hand_count += 1
    return hand_count >= min_hand_frames
```

### 2.8 Expected Data Yield

| Per Sign (conservative) | Value |
|-------------------------|-------|
| WLASL videos available | ~15-40 |
| Avg video length | ~60 frames |
| Sequences per video (stride=15) | ~2-3 |
| Raw sequences | ~40-100 |
| After quality filtering (~20% drop) | ~32-80 |
| + Self-recorded sequences | +30 |
| **Total per sign** | **~60-110** |

This is 2-4x more data per sign than the original plan, and from **dozens of different signers**.

### 2.9 Saving to MP_Data Format

```python
def save_sequences(sign_name, sequences, data_path, start_idx=0):
    """
    Save sequences in the MP_Data/{action}/{seq_idx}/{frame_num}.npy format.

    Numbering starts at start_idx to avoid overwriting self-recorded data.
    """
    for seq_idx, sequence in enumerate(sequences):
        seq_dir = os.path.join(data_path, sign_name, str(start_idx + seq_idx))
        os.makedirs(seq_dir, exist_ok=True)
        for frame_num, keypoints in enumerate(sequence):
            np.save(os.path.join(seq_dir, str(frame_num)), keypoints)

    return start_idx + len(sequences)  # next available index
```

### 2.10 Merging Self-Recorded + WLASL Data

Self-recorded data (from Phase 1) occupies sequences 0-29 for each sign. WLASL data starts at sequence 30+.

```
MP_Data/Hello/
  ├── 0/ ... 29/    ← self-recorded (Phase 1)
  ├── 30/ ... 62/   ← WLASL signer A, B, C, ...
```

The training script loads all sequences it finds — no merge step needed beyond placing files correctly.

### 2.11 import_wlasl.py Script Structure

```
ml/import_wlasl.py

Usage:
    python import_wlasl.py --wlasl_dir /path/to/wlasl --json /path/to/WLASL_v0.3.json
    python import_wlasl.py --wlasl_dir /path/to/wlasl --json /path/to/WLASL_v0.3.json --dry_run

Arguments:
    --wlasl_dir     Path to extracted WLASL video directory
    --json          Path to WLASL_v0.3.json metadata file
    --data_path     Output directory (default: ml/MP_Data/)
    --dry_run       Print statistics without processing
    --signs         Comma-separated signs to process (default: all in ACTIONS)
    --max_videos    Max videos per sign (default: unlimited)
    --min_hands     Min frames with hand detection per sequence (default: 10)

Steps:
    1. Load WLASL JSON metadata
    2. For each target sign:
       a. Find matching gloss in WLASL
       b. Collect all video instances
       c. For each video:
          - Open with OpenCV
          - Seek to frame_start:frame_end
          - Run MediaPipe Holistic per frame
          - Extract 1662-dim keypoints
          - Apply sliding window (30 frames, stride 15)
          - Filter sequences by hand detection quality
          - Save to MP_Data/{sign}/{seq_idx}/{frame_num}.npy
    3. Print summary: sequences per sign, total frames, dropped sequences

Estimated runtime: 2-4 hours on CPU (MediaPipe is the bottleneck)
Can parallelize: process multiple signs concurrently with multiprocessing
```

### 2.12 Updating Existing Files

**`ml/utils.py`** — Update ACTIONS array:
```python
# Replace the 10-sign array with the 50-sign array
ACTIONS = np.array([
    'Hello', 'Thank_You', 'Help', 'Yes', 'No',
    # ... all 50 signs
])
```

**`ml/train_model.py`** — Already uses `len(ACTIONS)` for the Dense output layer. Should auto-adapt. Verify:
- Line that builds `Dense(len(ACTIONS), activation='softmax')` — should just work
- May want to increase batch size (32 instead of 16) for 50 classes
- May want more epochs (300 instead of 200)

**`ml/verify_data.py`** — Currently iterates over signs. Check if it hardcodes the 10 signs or imports from utils. If hardcoded, update to use ACTIONS from utils.

**`ml/training_notebook.ipynb`** — Update Cell 3 (configuration) to match new ACTIONS array.

---

## Phase 3: Upgrade LSTM → Transformer (Hours 13-22)

### Goal
Replace the 3-layer LSTM with a lightweight Transformer encoder for better accuracy at 50+ classes.

### Why Transformer Over LSTM

| | LSTM (current) | Transformer |
|---|---|---|
| Sequence modeling | Sequential (left-to-right) | Attends to all positions simultaneously |
| Long-range dependencies | Degrades with distance | Handles equally well |
| Training speed | Sequential, slow | Parallelizable, faster on GPU |
| Scalability | OK for 10 classes, struggles at 50+ | Designed for larger vocabularies |
| Inference speed | ~50ms | ~30-50ms (comparable, smaller model) |

### Architecture

```
Input: (batch, 30, 1662)
  → Linear projection: 1662 → 128 (reduce dimensionality)
  → Positional encoding (learned, 30 positions)
  → Transformer Encoder (2 layers, 4 heads, d_model=128, d_ff=256)
  → Global average pooling over sequence dimension
  → Dense(64, relu) → Dropout(0.2)
  → Dense(num_classes, softmax)

Total params: ~200K (vs ~300K for current LSTM)
```

### Implementation: `ml/transformer_model.py`

```python
"""
Lightweight Transformer encoder for sign language classification.

Replaces the 3-layer LSTM. Same input/output contract:
- Input: (batch, 30, 1662)
- Output: (batch, num_classes) softmax probabilities
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


class PositionalEncoding(layers.Layer):
    """Learned positional encoding for sequence positions."""

    def __init__(self, max_len, d_model, **kwargs):
        super().__init__(**kwargs)
        self.pos_embedding = layers.Embedding(max_len, d_model)
        self.max_len = max_len

    def call(self, x):
        positions = tf.range(start=0, limit=self.max_len, delta=1)
        return x + self.pos_embedding(positions)


class TransformerBlock(layers.Layer):
    """Single Transformer encoder block."""

    def __init__(self, d_model, num_heads, d_ff, dropout=0.1, **kwargs):
        super().__init__(**kwargs)
        self.attention = layers.MultiHeadAttention(
            num_heads=num_heads, key_dim=d_model // num_heads
        )
        self.ffn = keras.Sequential([
            layers.Dense(d_ff, activation='gelu'),
            layers.Dense(d_model),
        ])
        self.norm1 = layers.LayerNormalization()
        self.norm2 = layers.LayerNormalization()
        self.dropout1 = layers.Dropout(dropout)
        self.dropout2 = layers.Dropout(dropout)

    def call(self, x, training=False):
        attn = self.attention(x, x, training=training)
        x = self.norm1(x + self.dropout1(attn, training=training))
        ffn = self.ffn(x, training=training)
        x = self.norm2(x + self.dropout2(ffn, training=training))
        return x


def build_transformer_model(
    seq_length=30,
    num_features=1662,
    num_classes=50,
    d_model=128,
    num_heads=4,
    d_ff=256,
    num_layers=2,
    dropout=0.2,
):
    """
    Build a lightweight Transformer encoder for sign classification.

    Args:
        seq_length: Number of frames per sequence (30)
        num_features: Keypoint features per frame (1662)
        num_classes: Number of sign classes (50)
        d_model: Transformer hidden dimension (128)
        num_heads: Attention heads (4)
        d_ff: Feed-forward hidden dimension (256)
        num_layers: Number of Transformer blocks (2)
        dropout: Dropout rate (0.2)

    Returns:
        Compiled Keras model
    """
    inputs = layers.Input(shape=(seq_length, num_features))

    # Project high-dim keypoints to model dimension
    x = layers.Dense(d_model)(inputs)

    # Add positional encoding
    x = PositionalEncoding(seq_length, d_model)(x)
    x = layers.Dropout(dropout)(x)

    # Transformer encoder blocks
    for _ in range(num_layers):
        x = TransformerBlock(d_model, num_heads, d_ff, dropout)(x)

    # Pool over sequence → single vector
    x = layers.GlobalAveragePooling1D()(x)

    # Classification head
    x = layers.Dense(64, activation='relu')(x)
    x = layers.Dropout(dropout)(x)
    outputs = layers.Dense(num_classes, activation='softmax')(x)

    model = keras.Model(inputs, outputs)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='categorical_crossentropy',
        metrics=['categorical_accuracy'],
    )
    return model
```

### Integration with train_model.py

Add a `--model_type` flag:

```bash
python train_model.py --model_type transformer --epochs 200 --batch_size 32
python train_model.py --model_type lstm --epochs 200 --batch_size 16  # (default, backward compat)
```

The training script imports the appropriate build function based on the flag. Output model saved to the same `action_model.h5` path — the WebSocket server doesn't care about architecture, just input/output shapes.

### Fallback

If the Transformer doesn't converge well or takes too long to tune, fall back to the LSTM. The LSTM already works — the Transformer is an improvement, not a requirement. Train both, compare accuracy, ship whichever is better.

---

## Phase 4: Sentence Assembly (Hours 23-30)

### Goal
String detected signs into readable text displayed to the user. Not real continuous sign language recognition — just concatenating isolated detections with pause-based segmentation.

### How It Works

The WebSocket server already tracks `is_new_sign` via the StabilityFilter. When a new stable sign is detected, append it to a sentence buffer. When no new sign appears for N seconds, treat it as a sentence break.

```
User signs:   [Hello] ~~pause~~ [Help] ~~pause~~ [Please] ~~long pause~~
Buffer:       ["Hello"]         ["Hello", "Help"]  ["Hello", "Help", "Please"]
Output:       "Hello"           "Hello Help"        "Hello Help Please"
After long pause → sentence complete, reset buffer
```

### Server-Side Changes to `ws_server.py`

Add per-connection sentence state:

```python
# Per-connection state (add to existing)
sentence_buffer = []           # accumulated signs
last_sign_time = time.time()   # timestamp of last new sign
SENTENCE_TIMEOUT = 2.0         # seconds of silence = sentence break
```

In the prediction response logic, after the stability filter:

```python
current_time = time.time()

if is_new_sign:
    # Check if we should start a new sentence (long pause since last sign)
    if sentence_buffer and (current_time - last_sign_time) > SENTENCE_TIMEOUT:
        # Send completed sentence
        await websocket.send_json({
            "type": "sentence_complete",
            "sentence": " ".join(sentence_buffer),
        })
        sentence_buffer = []

    sentence_buffer.append(stability_result["sign"])
    last_sign_time = current_time

# Always include current sentence in prediction response
# Add to the existing sign_prediction response:
"sentence_in_progress": " ".join(sentence_buffer),
```

### New Message Type: `sentence_complete`

```json
{
    "type": "sentence_complete",
    "sentence": "Hello Help Please"
}
```

Sent when a pause of `SENTENCE_TIMEOUT` seconds occurs after at least one sign has been detected.

### Updated `sign_prediction` Response

```json
{
    "type": "sign_prediction",
    "sign": "Help",
    "confidence": 0.93,
    "is_stable": true,
    "is_new_sign": true,
    "hands_detected": true,
    "all_predictions": { ... },
    "frames_processed": 150,
    "total_inference_ms": 45.2,
    "sentence_in_progress": "Hello Help"
}
```

New field: `sentence_in_progress` — the current accumulated sentence as a string.

### Configuration

Add to `ml/utils.py`:
```python
SENTENCE_TIMEOUT = _safe_float("SENSEAI_SENTENCE_TIMEOUT", 2.0)
```

### Frontend Integration Note

The frontend team can either:
1. Use `sentence_in_progress` from every `sign_prediction` message to display live text
2. Wait for `sentence_complete` to display finalized sentences
3. Both — show in-progress text in one area, completed sentences in another

---

## 30-Hour Schedule

| Hours | Phase | Deliverable | Who |
|-------|-------|-------------|-----|
| 1-2 | Phase 1 | Record 10 signs with webcam | Both team members |
| 2-3 | Phase 1 | Verify data, train baseline on Colab | 1 person |
| 3-4 | Phase 1 | Confirm WebSocket works end-to-end | 1 person |
| 5-6 | Phase 2 | Download Kaggle WLASL dataset, parse JSON, pick 40 new signs | 1 person |
| 6-9 | Phase 2 | Write `import_wlasl.py`, process videos through MediaPipe | 1 person |
| 9-10 | Phase 2 | Run extraction (can background while doing other work) | Machine |
| 10-11 | Phase 2 | Verify extracted data quality, merge with self-recorded | 1 person |
| 11-12 | Phase 2 | Update ACTIONS in utils.py, retrain on 50 signs | Colab |
| 13-16 | Phase 3 | Implement `transformer_model.py` | 1 person |
| 16-18 | Phase 3 | Integrate with `train_model.py` (--model_type flag) | Same person |
| 18-20 | Phase 3 | Train Transformer on Colab, compare with LSTM | Colab |
| 20-22 | Phase 3 | Update ws_server.py to load best model, test end-to-end | 1 person |
| 23-25 | Phase 4 | Add sentence buffer to ws_server.py | 1 person |
| 25-26 | Phase 4 | Add SENTENCE_TIMEOUT config, new message types | Same person |
| 26-27 | Finish | Complete Phase 18 (WebSocket protocol docs) | 1 person |
| 27-28 | Finish | Run full test suite, fix any failures | Both |
| 28-30 | Finish | End-to-end demo testing, bug fixes | Both |

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WLASL vocabulary mismatch | Medium | High | Parse JSON first (dry run), adjust sign list before processing |
| MediaPipe fails on WLASL videos | Medium | Medium | Quality filter drops bad sequences; need ≥20 good sequences per sign |
| Transformer doesn't converge | Low | Medium | Fall back to LSTM — it already works |
| WLASL processing takes too long | Medium | Medium | Use `--max_videos 20` to cap, process overnight if needed |
| Kaggle download issues | Low | High | Alternative: request pre-processed from WLASL maintainers |
| 50 signs too many, accuracy drops | Medium | Medium | Reduce to 30 best signs based on confusion matrix |

## End State

After 30 hours:

| Attribute | Before | After |
|-----------|--------|-------|
| Signs | 10 (untrained) | 50+ (trained, validated) |
| Signers in data | 0 | Team + WLASL (dozens) |
| Architecture | LSTM | Transformer (or best of both) |
| Expected accuracy | N/A | ~93-97% |
| Sentence detection | No | Yes (pause-based) |
| New message types | 0 | `sentence_complete`, `sentence_in_progress` field |
| Remaining roadmap phases | 2 | 0 |

---

## Appendix A: WLASL Keypoint Extraction — Full Pipeline

```
For each target sign:
    1. Look up gloss in WLASL_v0.3.json
    2. Get all video instances for that gloss
    3. For each instance:
        a. Open {video_id}.mp4 with cv2.VideoCapture
        b. Seek to frame_start (skip frames before the sign)
        c. Read frames until frame_end
        d. For each frame:
            - mediapipe_detection(frame, holistic) → results
            - extract_keypoints(results) → (1662,) array
        e. Apply sliding window: seq_length=30, stride=15
        f. For each candidate sequence:
            - Run has_enough_hands() quality check
            - If passes: save to MP_Data/{sign}/{next_seq_idx}/{frame}.npy
    4. Log: "{sign}: {n_sequences} sequences from {n_videos} videos ({n_signers} signers)"
```

## Appendix B: Model Input/Output Contract (Unchanged)

```
Input:  (batch_size, 30, 1662)  float32
Output: (batch_size, N_CLASSES)  float32 (softmax)

Where N_CLASSES = len(ACTIONS) = 50 (was 10)

Keypoint order (CRITICAL — DO NOT CHANGE):
  [0:132]      pose      33 landmarks × 4 (x, y, z, visibility)
  [132:1536]   face      468 landmarks × 3 (x, y, z)
  [1536:1599]  left_hand 21 landmarks × 3 (x, y, z)
  [1599:1662]  right_hand 21 landmarks × 3 (x, y, z)
```

## Appendix C: WebSocket Protocol After Upgrade

### Client → Server

```json
{"type": "frame", "frame": "<base64 JPEG>"}
```

No changes.

### Server → Client

**Buffering (unchanged):**
```json
{
    "type": "buffering",
    "frames_collected": 15,
    "frames_needed": 30,
    "hands_detected": true
}
```

**Sign Prediction (updated — new field):**
```json
{
    "type": "sign_prediction",
    "sign": "Help",
    "confidence": 0.93,
    "is_stable": true,
    "is_new_sign": true,
    "hands_detected": true,
    "all_predictions": {"Hello": 0.02, "Help": 0.93, ...},
    "frames_processed": 150,
    "total_inference_ms": 45.2,
    "sentence_in_progress": "Hello Help"
}
```

**Sentence Complete (new):**
```json
{
    "type": "sentence_complete",
    "sentence": "Hello Help Please"
}
```

**Error (unchanged):**
```json
{"type": "error", "message": "Rate limit exceeded: max 60 frames per 10 seconds"}
```
