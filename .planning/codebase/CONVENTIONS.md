# Coding Conventions

**Analysis Date:** 2026-02-10

## Naming Patterns

**Files:**
- `snake_case.py` for all Python modules (`collect_data.py`, `ws_server.py`, `train_model.py`)
- `test_{module}.py` for automated tests alongside source in `ml/tests/`
- `PascalCase.tsx` for React components (`App.tsx`)
- `UPPERCASE.md` for important documents (`README.md`, `CLAUDE.md`)

**Functions:**
- `snake_case` for all Python functions (`mediapipe_detection`, `extract_keypoints`, `decode_frame`)
- `_leading_underscore` for private/helper functions (`_ensure_mediapipe_solutions`, `_make_landmarks`)
- `camelCase` for TypeScript functions (`handleNext`, `onNodesChange`, `createNode`)

**Variables:**
- `snake_case` for Python variables (`keypoint_buffer`, `frame_times`, `holistic`)
- `SCREAMING_SNAKE_CASE` for Python constants (`ACTIONS`, `SEQUENCE_LENGTH`, `MODEL_PATH`, `CONFIDENCE_THRESHOLD`)
- `camelCase` for TypeScript variables (`nodeWidth`, `visibleCount`, `nodePositions`)

**Types:**
- `PascalCase` for Python classes (`StabilityFilter`, `MockLandmark`)
- `PascalCase` for TypeScript types (`Phase`, `Node`, `Edge`)
- Type hints on all public Python functions (PEP 484)
- TypeScript strict mode with `type` keyword for imports

## Code Style

**Formatting (Python):**
- 4 spaces indentation (PEP 8)
- Single quotes for strings
- No explicit formatter configured (follows PEP 8 manually)
- Line length: approximately 100 characters (not enforced)

**Formatting (TypeScript):**
- 2 spaces indentation
- Single quotes for strings and imports
- Semicolons used consistently
- Modern functional component style with hooks

**Linting:**
- Python: No explicit linter configured (type hints provide static analysis)
- TypeScript: ESLint 9.39.1 (`vendor/ralph-loop/flowchart/eslint.config.js`)
  - Extends: `eslint/recommended`, `typescript-eslint/recommended`, `react-hooks/recommended`
  - TypeScript strict mode: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`

## Import Organization

**Python:**
1. Standard library (`os`, `sys`, `logging`, `argparse`, `collections`, `contextlib`)
2. Third-party packages (`numpy`, `tensorflow`, `mediapipe`, `cv2`, `fastapi`)
3. Local imports (`from utils import ACTIONS, extract_keypoints`)

No blank lines between groups in practice. No path aliases.

**TypeScript:**
1. React/framework imports (`import { useState, useCallback } from 'react'`)
2. Type imports (`import type { Node, Edge } from '@xyflow/react'`)
3. Library imports (`import { ReactFlow, Controls } from '@xyflow/react'`)
4. Local imports (`import './App.css'`)

## Error Handling

**Patterns:**
- Log errors with context before handling (`logger.error(f"Failed to load model: {e}")`)
- Graceful degradation where possible (server starts even without model)
- Runtime assertions for critical contracts (`assert result.shape == (1662,)`)
- Specific exception types where known (`except (binascii.Error, ValueError)`, `except (ValueError, OSError, EOFError)`)

**Error Types:**
- Assertions for invariant violations (keypoint shape)
- Specific exceptions for expected failures (file not found, decode errors)
- Broad `except Exception` only at top-level handlers (WebSocket frame processing)
- SystemExit for CLI validation failures

## Logging

**Framework:**
- Python `logging` module (`ml/ws_server.py`, `ml/train_model.py`)
- Instance: `logger = logging.getLogger(__name__)`
- Levels: INFO, WARNING, ERROR

**Patterns:**
- Format: `%(asctime)s [%(levelname)s] %(message)s`
- Log at service boundaries (model loading, client connect/disconnect)
- Log performance thresholds (`if inference_ms > 200: logger.warning(...)`)
- No `console.log` in Python code

## Comments

**When to Comment:**
- Critical contracts: Document invariants that MUST NOT change (`extract_keypoints` order)
- Sectional headers: Visual separators for code organization (`# ========================`)
- Business logic: Explain why specific thresholds or values chosen
- Non-obvious algorithms: Keypoint vector breakdown (132 + 1404 + 63 + 63 = 1662)

**Docstrings:**
- Required for all modules (triple-quoted, at top of file)
- Required for all public functions (Google-style with Args, Returns, Raises)
- Classes: Purpose and usage in class docstring, method-level for complex methods
- Critical contracts prominently documented:
  ```python
  """
  CRITICAL CONTRACT:
  - extract_keypoints returns shape (1662,)
  - Keypoint order: [pose, face, lh, rh] -- DO NOT CHANGE
  """
  ```

**Section Headers:**
```python
# ========================
# SHARED CONSTANTS
# ========================
```

**TODO Comments:**
- Format: `# TODO: description`
- Tracked in `docs/TODO.md` for Ralph loop consumption

## Function Design

**Size:**
- Keep functions focused on single responsibility
- `extract_keypoints()`: ~40 lines (extraction + assertion)
- `sign_detection()` WebSocket handler: ~116 lines (complex but single flow)

**Parameters:**
- Type hints on all parameters and return types
- Defaults for optional parameters (`window_size: int = 8`)
- CLI arguments via argparse with sensible defaults
- Environment variable fallbacks via `os.environ.get()`

**Return Values:**
- Explicit return types in type hints
- None for error cases in frame decoding
- Dict for structured results (StabilityFilter.update())
- NumPy arrays for numerical data

## Module Design

**Exports:**
- `ml/utils.py` is the shared export hub (constants, functions, classes)
- All ML scripts import from `utils` for shared values
- No barrel files or index.ts pattern in Python code

**Single Source of Truth:**
- Constants defined once in `ml/utils.py`, imported everywhere
- No duplication of ACTIONS, SEQUENCE_LENGTH, MODEL_PATH across files
- Environment variable config centralized in `ml/utils.py`

---

*Convention analysis: 2026-02-10*
*Update when patterns change*
