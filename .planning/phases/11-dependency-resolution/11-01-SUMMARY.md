---
phase: 11-dependency-resolution
plan: 01
subsystem: infra
tags: [python, venv, mediapipe, tensorflow, numpy, opencv, pip, dependencies]

# Dependency graph
requires:
  - phase: v1.0 (phases 1-10)
    provides: All ML pipeline scripts using mp.solutions.holistic API
provides:
  - Working Python 3.12 venv at ml/venv/
  - Compatible dependency set (mediapipe 0.10.21 + tensorflow 2.16.2 + numpy 1.26.4)
  - Verified imports and utils contract
  - Updated PROJECT.md constraints
affects: [12-consolidate-config, 13-error-handling, 14-security, 15-unit-tests]

# Tech tracking
tech-stack:
  added: [mediapipe-0.10.21, tensorflow-2.16.2, numpy-1.26.4, opencv-python-4.11.0.86, fastapi-0.128.6, scikit-learn-1.6.1]
  patterns: [venv-based Python 3.12 environment, py -3.12 launcher for venv creation]

key-files:
  created: [ml/venv/]
  modified: [ml/requirements.txt, ml/test_setup.py, .planning/PROJECT.md]

key-decisions:
  - "Use mediapipe 0.10.21 (last version with mp.solutions.holistic legacy API) instead of 0.10.32 (which removed it)"
  - "Pin tensorflow 2.16.2 (not 2.20.0) because mediapipe 0.10.21 requires numpy<2"
  - "Pin numpy 1.26.4, opencv-python 4.11.0.86 for full compatibility chain"

patterns-established:
  - "Run all ml/ scripts via ml/venv/Scripts/python.exe (never system Python)"

issues-created: []

# Metrics
duration: 35min
completed: 2026-02-10
---

# Phase 11 Plan 01: Dependency Resolution Summary

**Python 3.12 venv with mediapipe 0.10.21 + tensorflow 2.16.2 — all imports pass, mp.solutions.holistic preserved, test_setup.py ALL CHECKS PASSED**

## Performance

- **Duration:** 35 min
- **Started:** 2026-02-10T02:24:37Z
- **Completed:** 2026-02-10T02:59:21Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created Python 3.12 venv at ml/venv/ with all dependencies installed
- Resolved critical dependency conflict: mediapipe 0.10.32 removed mp.solutions (entire codebase depends on it), pinned to 0.10.21 (last version with legacy API)
- Cascading version pins: mediapipe 0.10.21 needs numpy<2, so tensorflow pinned to 2.16.2 (compatible with numpy 1.26.4)
- All 6 import checks pass, webcam accessible, MediaPipe Holistic runs without errors, utils contract verified (1662 keypoints)
- Updated PROJECT.md constraints to reflect actual installed versions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Python 3.12 venv and install dependencies** - `eb9c805` (chore) — requirements.txt updated with compatible versions, venv created and verified
2. **Task 2: Run test_setup.py to verify full environment** - `9837983` (fix) — Python version warning updated from >3.11 to >3.12
3. **Task 3: Update PROJECT.md constraints** - `a76734a` + `57a24bd` (docs + fix) — initial update then corrected to match actual installed versions

## Files Created/Modified

- `ml/venv/` - Python 3.12 virtual environment (gitignored)
- `ml/requirements.txt` - Updated dependency versions: mediapipe 0.10.21, tensorflow 2.16.2, numpy 1.26.4, opencv-python 4.11.0.86, scikit-learn 1.6.1
- `ml/test_setup.py` - Python version warning changed from >3.11 to >3.12
- `.planning/PROJECT.md` - Constraints section updated with Python 3.12, correct dependency versions, venv location

## Decisions Made

- **mediapipe 0.10.21 instead of 0.10.32:** MediaPipe 0.10.30+ removed the `mp.solutions` module entirely (confirmed via [GitHub issue #6192](https://github.com/google-ai-edge/mediapipe/issues/6192)). The entire codebase (utils.py, ws_server.py, collect_data.py, test_realtime.py, test_setup.py) depends on `mp.solutions.holistic`. Migrating to MediaPipe Tasks API would be a major rewrite. Pinning to 0.10.21 preserves the working API.
- **tensorflow 2.16.2 instead of 2.20.0:** mediapipe 0.10.21 requires `numpy<2`. TF 2.20.0 requires `numpy>=2`. TF 2.16.2 works with numpy 1.26.4. The model is a simple Keras LSTM — TF 2.16 loads and runs it identically.
- **numpy 1.26.4:** Forced by mediapipe 0.10.21's `numpy<2` constraint. Compatible with all other packages.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Downgraded mediapipe from 0.10.32 to 0.10.21 and cascading deps**

- **Found during:** Task 1 (dependency installation)
- **Issue:** Original requirements.txt specified mediapipe 0.10.32 which removed `mp.solutions.holistic` — the entire codebase depends on this API. Installing 0.10.32 caused `AttributeError: module 'mediapipe' has no attribute 'solutions'`
- **Fix:** Pinned mediapipe 0.10.21 (last version with legacy API), cascaded to tensorflow 2.16.2, numpy 1.26.4, opencv-python 4.11.0.86, scikit-learn 1.6.1
- **Files modified:** ml/requirements.txt
- **Verification:** All imports pass, test_setup.py ALL CHECKS PASSED, mp.solutions.holistic confirmed available
- **Committed in:** eb9c805

---

**Total deviations:** 1 auto-fixed (blocking dependency conflict)
**Impact on plan:** Essential fix — without it, no pipeline script would run. The version downgrades are safe; TF 2.16 runs the same Keras LSTM model.

## Issues Encountered

- Initial subagent installed mediapipe 0.10.32 which broke mp.solutions — required recreating venv with correct version chain
- mediapipe 0.10.21 + TF 2.20.0 conflict on numpy version — resolved by pinning TF 2.16.2
- Attempted mediapipe 0.10.31 as middle ground but it also lacked mp.solutions and had protobuf conflicts with TF

## Next Phase Readiness

- Python 3.12 venv is fully functional — all scripts can run via `ml/venv/Scripts/python.exe`
- MediaPipe Holistic detection confirmed working
- Ready for Phase 12 (Consolidate Constants & Config)
- No blockers

---
*Phase: 11-dependency-resolution*
*Completed: 2026-02-10*
