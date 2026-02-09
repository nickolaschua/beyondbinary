# Testing Patterns

**Analysis Date:** 2026-02-10

## Test Framework

**Runner:**
- No formal test framework (no pytest, unittest, nose)
- Manual integration tests via executable Python scripts
- `sys.exit(0)` for pass, `sys.exit(1)` for fail

**Assertion Library:**
- Built-in Python `assert` statements
- Manual condition checks with print-based PASS/FAIL output

**Run Commands:**
```bash
python ml/test_setup.py                    # Environment verification
python ml/verify_data.py                   # Data quality check
python ml/test_realtime.py                 # Real-time inference (interactive, press 'q')
python ml/test_ws_health.py                # Server health check (requires server running)
python ml/test_ws_client.py                # WebSocket client test (requires server running)
```

## Test File Organization

**Location:**
- Co-located with source code in `ml/` directory
- No separate `tests/` directory

**Naming:**
- `test_*.py` prefix for verification scripts
- `verify_*.py` for data quality scripts

**Structure:**
```
ml/
  utils.py              # Shared utilities (tested by test_setup.py)
  train_model.py        # Training (validated by verify_data.py + confusion matrix)
  ws_server.py          # Server (tested by test_ws_health.py + test_ws_client.py)
  collect_data.py       # Data collection (validated by verify_data.py)
  test_setup.py         # Environment validation
  test_realtime.py      # Real-time inference test (interactive)
  test_ws_client.py     # WebSocket client test
  test_ws_health.py     # Server health check
  verify_data.py        # Data quality verification
```

## Test Structure

**Suite Organization:**
```python
"""
Module docstring with purpose and usage.

Run:
    python test_script.py
"""

def check_specific_aspect():
    """Check one specific thing."""
    # Implementation
    return True  # or False

def main():
    """Orchestrate all checks."""
    results = []
    results.append(("Import checks", check_imports()))
    results.append(("Webcam check", check_webcam()))
    results.append(("Utils contract", check_utils_contract()))

    passed = all(r[1] for r in results)
    if passed:
        print("ALL CHECKS PASSED")
        sys.exit(0)
    else:
        print("SOME CHECKS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
```

**Patterns:**
- Each test script has a `main()` function as entry point
- Individual check functions return True/False
- Summary output at end with overall PASS/FAIL
- Exit codes: 0 = pass, 1 = fail

## Mocking

**Framework:**
- No mocking framework used
- All tests use real components (real webcam, real MediaPipe, real trained model)

**What's Tested with Real Components:**
- Webcam access (OpenCV VideoCapture)
- MediaPipe Holistic detection
- TensorFlow model loading and inference
- WebSocket server connections
- Frame encoding/decoding

**What's NOT Mocked:**
- Everything uses real dependencies (no unittest.mock, no pytest fixtures)
- Integration-first testing philosophy

## Fixtures and Factories

**Test Data:**
- No pre-recorded test fixtures
- Real webcam frames captured during tests
- Trained model loaded from `models/action_model.h5`
- Data quality verified from actual `MP_Data/` recordings

**Location:**
- No `tests/fixtures/` directory
- No factory functions
- Each test script is self-contained

## Coverage

**Requirements:**
- No coverage target or tracking
- No coverage tools configured (no coverage.py, pytest-cov)
- Integration testing prioritized over unit coverage

**What IS Tested:**

| Component | Test File | Type |
|-----------|-----------|------|
| Dependencies & imports | `ml/test_setup.py` | Smoke test |
| Webcam access | `ml/test_setup.py` | Hardware test |
| MediaPipe Holistic | `ml/test_setup.py` | Integration |
| Keypoint shape contract (1662,) | `ml/test_setup.py` | Contract test |
| Data sequence counts | `ml/verify_data.py` | Validation |
| Keypoint shapes | `ml/verify_data.py` | Validation |
| Hand detection rates | `ml/verify_data.py` | Data quality |
| Model loading | `ml/test_realtime.py` | Integration |
| Inference pipeline | `ml/test_realtime.py` | Manual/visual |
| Confidence + stability filtering | `ml/test_realtime.py` | Manual/visual |
| Server health endpoint | `ml/test_ws_health.py` | Smoke test |
| WebSocket frame streaming | `ml/test_ws_client.py` | Integration |
| Latency measurement | `ml/test_ws_client.py` | Performance |

**What is NOT Tested:**
- Unit tests for individual functions (no isolated testing)
- Negative cases (invalid input, corrupted data)
- Edge cases (extremely fast/slow predictions, model overload)
- Concurrent WebSocket clients (multi-user stress test)
- Error recovery (server restart, network interruption)

## Test Types

**Environment Validation (`ml/test_setup.py`):**
- Scope: Verify all dependencies installed, webcam accessible, MediaPipe works, utils contract valid
- Automated: Yes (run and check exit code)
- Time: ~10 seconds

**Data Quality (`ml/verify_data.py`):**
- Scope: Verify collected data meets training requirements
- Checks: Sequence counts (30 per sign), keypoint shape (1662,), hand detection (>15/30)
- Automated: Yes (exit code 0/1)
- Time: ~5 seconds

**Real-Time Inference (`ml/test_realtime.py`):**
- Scope: Full webcam-to-prediction pipeline with visualization
- Automated: No (requires human observation, press 'q' to quit)
- Time: Interactive (until user exits)

**WebSocket Integration (`ml/test_ws_client.py`, `ml/test_ws_health.py`):**
- Scope: Server health + WebSocket frame streaming with latency measurement
- Prerequisites: Server must be running on port 8001
- Automated: Partially (health check is automated, client test is interactive)
- Time: Health check ~1 second, client test is interactive

## Common Patterns

**Exit Code Testing:**
```python
def main():
    all_passed = True

    if not check_imports():
        all_passed = False
    if not check_webcam():
        all_passed = False

    sys.exit(0 if all_passed else 1)
```

**Data Quality Thresholds (`ml/verify_data.py`):**
```python
if hands_count < 15:
    critical_failure = True
    warnings.append(f"CRITICAL: '{action}' has only {hands_count}/30 hands")
elif hands_count < 20:
    warnings.append(f"WARNING: '{action}' has only {hands_count}/30 hands")
```

**Async WebSocket Testing (`ml/test_ws_client.py`):**
```python
async def run_client():
    async with websockets.connect(SERVER_URL) as ws:
        send_time = time.time()
        await ws.send(json.dumps({"type": "frame", "frame": b64_frame}))
        response = await ws.recv()
        latency_ms = (time.time() - send_time) * 1000
```

**Snapshot Testing:**
- Not used in this codebase

## Test Execution Workflow

```bash
# Full verification sequence:
python ml/test_setup.py          # 1. Environment OK?
python ml/collect_data.py        # 2. Record data (interactive)
python ml/verify_data.py         # 3. Data quality OK?
python ml/train_model.py         # 4. Train model
python ml/test_realtime.py       # 5. Model works? (interactive)

# WebSocket server testing (2 terminals):
# Terminal 1:
uvicorn ml.ws_server:app --port 8001
# Terminal 2:
python ml/test_ws_health.py      # 6. Server healthy?
python ml/test_ws_client.py      # 7. End-to-end OK? (interactive)
```

---

*Testing analysis: 2026-02-10*
*Update when test patterns change*
