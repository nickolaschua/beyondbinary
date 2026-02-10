# Coding Conventions

**Analysis Date:** 2026-02-10

## Naming Patterns

**Files:**
- snake_case.py for all Python files (`train_model.py`, `ws_server.py`, `collect_data.py`)
- test_*.py prefix for test scripts (`test_setup.py`, `test_ws_client.py`)
- UPPERCASE.md for important documents (`PROJECT.md`, `ROADMAP.md`)

**Functions:**
- snake_case for all functions (`extract_keypoints`, `mediapipe_detection`, `build_model`, `load_data`)
- No special prefix for async functions (`async def sign_detection`, `async def load_model`)
- Descriptive verb-noun naming (`draw_landmarks`, `plot_confusion_matrix`, `parse_args`)

**Variables:**
- snake_case for variables (`keypoint_buffer`, `prediction_history`, `current_sign`, `frames_processed`)
- UPPER_SNAKE_CASE for constants (`ACTIONS`, `SEQUENCE_LENGTH`, `CONFIDENCE_THRESHOLD`, `MODEL_PATH`)
- No underscore prefix for private members

**Types:**
- Minimal type annotations (Python ML/data science style)
- Type hints on function signatures where used (`data_path: str`, `-> np.ndarray`)
- No formal type checking (no mypy, pyright)

## Code Style

**Formatting:**
- No formal formatter configured (no Black, autopep8, .prettierrc)
- 4-space indentation (PEP 8 compliant)
- Single quotes for string literals (`'Hello'`, `'frame'`)
- Double quotes for docstrings (`"""..."""`)
- Line length target: 80-100 characters

**Linting:**
- No linter configured (no .pylintrc, .flake8, pyproject.toml linting section)
- Manual code review for style consistency
- PEP 8 conventions followed by convention

## Import Organization

**Order:**
1. Standard library (`os`, `sys`, `logging`, `argparse`, `asyncio`, `base64`, `json`, `time`)
2. Third-party packages (`cv2`, `numpy`, `mediapipe`, `tensorflow`, `fastapi`, `websockets`)
3. Local modules (`from utils import ACTIONS, extract_keypoints, mediapipe_detection`)

**Grouping:**
- Blank line between each group
- Alphabetical within groups (loosely followed)
- Parenthesized multi-line imports for local modules

**Example from `ml/ws_server.py`:**
```python
import base64
import json
import logging
import time
from collections import deque

import cv2
import numpy as np
import mediapipe as mp
import tensorflow as tf
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from utils import (
    ACTIONS,
    SEQUENCE_LENGTH,
    MODEL_PATH,
    mediapipe_detection,
    extract_keypoints,
)
```

**Path Aliases:**
- None (direct imports only)

## Error Handling

**Patterns:**
- Try/except at boundary level (WebSocket handlers, data loading loops)
- Broad `except Exception` in production paths with logging
- Graceful degradation: log warning, skip invalid data, continue processing
- Context manager (`with`) for MediaPipe Holistic and webcam resources

**Error Types:**
- Throw on missing files, invalid configuration
- Log and skip for per-frame/per-sequence errors during training data loading
- Send JSON error response to WebSocket clients on frame decode failure
- Exit with code 1 for critical test failures

## Logging

**Framework:**
- Python `logging` module for production scripts (`ml/ws_server.py`, `ml/train_model.py`)
- `print()` for simple utility scripts (`ml/collect_data.py`, `ml/verify_data.py`)

**Setup Pattern:**
```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)
```

**Patterns:**
- `logger.info()` for progress messages and state transitions
- `logger.warning()` for non-critical issues (skipped sequences, low confidence)
- `logger.error()` for failures that impact functionality
- Emoji in print output for visual scripts (`"✓ Sequence recorded"`)

## Comments

**When to Comment:**
- Critical contracts: `# CRITICAL: do not change keypoint order`
- Section organization with dividers
- Non-obvious logic or magic numbers
- Keypoint index calculations with breakdown

**Module Docstrings (Required):**
```python
"""
SenseAI — Shared Utility Functions
====================================
Shared constants and functions used by all ML pipeline scripts.

CRITICAL CONTRACT:
- extract_keypoints returns shape (1662,)
- Keypoint order: [pose, face, lh, rh] — DO NOT CHANGE
"""
```

**Function Docstrings (Required):**
- Google/NumPy style with Args, Returns sections
- All public functions must have docstrings

**Section Dividers:**
```python
# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# ========================
# KEYPOINT EXTRACTION
# ========================
```

**TODO Comments:**
- No specific format enforced
- Minimal TODOs in current codebase

## Function Design

**Size:**
- Functions generally under 50 lines
- Longer functions for main training loop and WebSocket handler (acceptable for pipeline scripts)

**Parameters:**
- Explicit type hints on key parameters (`data_path: str`, `output_dir: str`)
- argparse for CLI configuration (`ml/train_model.py`)
- Module constants for runtime configuration

**Return Values:**
- Explicit returns
- Tuple returns for multi-value functions (`load_data` returns `X, y, skipped`)
- numpy arrays for data processing functions

## Module Design

**Exports:**
- Explicit imports from `utils.py` using `from utils import ...`
- No `__all__` definitions
- No barrel files or index modules

**Main Block:**
```python
def main():
    # Implementation
    pass

if __name__ == "__main__":
    main()
```
All executable scripts follow this pattern.

**Data Structures:**
- `collections.deque(maxlen=N)` for fixed-size sliding window buffers
- `np.ndarray` for all keypoint and prediction data
- `dict` comprehensions for prediction result formatting

---

*Convention analysis: 2026-02-10*
*Update when patterns change*
