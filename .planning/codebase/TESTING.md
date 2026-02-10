# Testing Patterns

**Analysis Date:** 2026-02-10

## Test Framework

**Runner:**
- pytest (Python) - 21 test files, 114+ test functions
- Config: `ml/conftest.py` (root) + `ml/tests/conftest.py` (fixtures)

**Assertion Library:**
- pytest built-in `assert` statements
- NumPy assertions for array comparisons (`np.all`, `np.any`)

**Run Commands:**
```bash
cd ml
python -m pytest tests/ -x -q --tb=short    # Run all tests (stop on first failure)
python -m pytest tests/ -v                    # Verbose output
python -m pytest tests/test_smoke.py          # Single file
python -m pytest tests/ -k "keypoints"        # Match keyword
```

## Test File Organization

**Location:**
- Automated tests: `ml/tests/test_*.py` (21 files)
- Manual tests: `ml/test_*.py` (4 files - require webcam/server)
- Configuration: `ml/conftest.py` (root) + `ml/tests/conftest.py` (fixtures)

**Naming:**
- `test_{module}.py` for module-specific tests (`test_extract_keypoints.py`)
- `test_{feature}.py` for feature-specific tests (`test_stability_filter.py`)
- `test_{module}_{aspect}.py` for focused aspects (`test_decode_frame_hardened.py`)

**Structure:**
```
ml/
  conftest.py                         # Root: patches MediaPipe globally
  tests/
    conftest.py                       # Fixtures: mock_results_all, mock_results_none, etc.
    test_smoke.py                     # Basic infrastructure validation
    test_constants.py                 # ACTIONS array validation
    test_config.py                    # Environment variable config
    test_extract_keypoints.py         # Keypoint extraction edge cases
    test_decode_frame.py              # Frame decoding from base64
    test_decode_frame_hardened.py     # Hardened decoding (size, URL)
    test_stability_filter.py          # Stability filter state machine
    test_load_data.py                 # Data loading and shape validation
    test_utils_assertion.py           # Runtime shape assertion
    test_utils_paths.py               # Path resolution
    test_utils_types.py               # Type hints on public functions
    test_collect_args.py              # collect_data.py CLI arguments
    test_collect_sequences.py         # Directory creation logic
    test_realtime_args.py             # test_realtime.py CLI arguments
    test_verify_cli.py                # verify_data.py CLI arguments
    test_train_exceptions.py          # Training exception handling
    test_train_lr.py                  # Learning rate CLI argument
    test_ws_server.py                 # WebSocket endpoint behavior
    test_ws_lifespan.py               # FastAPI lifespan (model loading)
    test_ws_rate_limit.py             # Per-client rate limiting
    test_ws_timing.py                 # Inference timing metrics
```

## Test Structure

**Suite Organization:**
```python
import pytest
import numpy as np
from utils import extract_keypoints

class TestAllLandmarksPresent:
    """(a) All landmarks present -> correct shape and non-zero values."""

    def test_shape_is_1662(self, mock_results_all):
        keypoints = extract_keypoints(mock_results_all)
        assert keypoints.shape == (1662,)

    def test_pose_section_nonzero(self, mock_results_all):
        keypoints = extract_keypoints(mock_results_all)
        pose = keypoints[0:132]
        assert np.any(pose != 0), "Pose section should have non-zero values"

class TestNoLandmarksDetected:
    """(b) No landmarks detected -> shape (1662,) all zeros."""

    def test_all_zeros(self, mock_results_none):
        keypoints = extract_keypoints(mock_results_none)
        assert np.all(keypoints == 0)
```

**Patterns:**
- Class-based grouping for related test cases (TestAllLandmarks, TestNoLandmarks, TestHandsOnly)
- Descriptive class docstrings explain the scenario being tested
- One assertion focus per test (but multiple expects OK)
- Fixtures via function parameters (`mock_results_all`, `monkeypatch`, `tmp_path`)

## Mocking

**Framework:**
- `unittest.mock` (MagicMock, patch)
- pytest `monkeypatch` fixture for environment variables
- Module-level mocking in `conftest.py`

**Critical Mock: MediaPipe Patching (`ml/conftest.py`):**
```python
def _ensure_mediapipe_solutions():
    """Patch mediapipe.solutions.holistic if it doesn't exist."""
    try:
        import mediapipe as mp
        _ = mp.solutions.holistic
    except AttributeError:
        solutions = types.ModuleType("mediapipe.solutions")
        holistic = types.ModuleType("mediapipe.solutions.holistic")
        holistic.FACEMESH_CONTOURS = None
        holistic.POSE_CONNECTIONS = None
        holistic.HAND_CONNECTIONS = None
        holistic.Holistic = mock.MagicMock
        solutions.holistic = holistic
        solutions.drawing_utils = mock.MagicMock()
        mp.solutions = solutions

_ensure_mediapipe_solutions()
```

**What to Mock:**
- MediaPipe runtime (no GPU/webcam needed for tests)
- Environment variables (via `monkeypatch.setenv`)
- File system for data tests (via `tmp_path` fixture)
- TensorFlow model loading (for server tests)

**What NOT to Mock:**
- `extract_keypoints()` logic (test the real function)
- `StabilityFilter` state machine (test actual behavior)
- NumPy operations (test real math)

## Fixtures and Factories

**Test Data (`ml/tests/conftest.py`):**
```python
class MockLandmark:
    """Mimics a single MediaPipe landmark with x, y, z, visibility."""
    def __init__(self, x=0.5, y=0.5, z=0.0, visibility=1.0):
        self.x, self.y, self.z, self.visibility = x, y, z, visibility

def _make_landmarks(count, seed=42):
    """Create deterministic MockLandmark objects."""
    rng = np.random.RandomState(seed)
    return [MockLandmark(rng.uniform(), rng.uniform(), rng.uniform(-1,1), rng.uniform())
            for _ in range(count)]

@pytest.fixture
def mock_results_all():
    """ALL landmarks present (pose=33, face=468, lh=21, rh=21)."""
    results = types.SimpleNamespace()
    results.pose_landmarks = _landmarks_container(_make_landmarks(33, seed=1))
    results.face_landmarks = _landmarks_container(_make_landmarks(468, seed=2))
    results.left_hand_landmarks = _landmarks_container(_make_landmarks(21, seed=3))
    results.right_hand_landmarks = _landmarks_container(_make_landmarks(21, seed=4))
    return results

@pytest.fixture
def mock_results_none():
    """NO landmarks detected (all None)."""

@pytest.fixture
def mock_results_hands_only():
    """Only hands detected (no pose/face)."""
```

**Location:**
- Shared fixtures: `ml/tests/conftest.py`
- Test-local data: inline in test files

## Coverage

**Requirements:**
- No enforced coverage target
- Focus on critical paths: keypoint extraction, stability filter, frame decoding, server endpoints
- Ralph verification gate: `pytest tests/ -x -q --tb=short` must pass before committing

**Configuration:**
- No explicit coverage tooling configured
- Tests can be run with `--cov` flag if needed

## Test Types

**Unit Tests (majority):**
- Test single function/class in isolation
- Mock external dependencies (MediaPipe, TensorFlow, filesystem)
- Fast: each test <100ms
- Examples: `test_extract_keypoints.py`, `test_stability_filter.py`, `test_config.py`

**Integration Tests:**
- Test module interactions
- Mock only external boundaries
- Examples: `test_ws_server.py` (FastAPI + decoding + response format)

**Manual Tests (not in automated suite):**
- `ml/test_realtime.py` - Live webcam inference (requires camera + model)
- `ml/test_setup.py` - Environment verification
- `ml/test_ws_client.py` - WebSocket client stress test (requires running server)
- `ml/test_ws_health.py` - Health endpoint check (requires running server)

**E2E Tests:** Not currently implemented

## Common Patterns

**Environment Variable Testing:**
```python
def test_host_env_override(self, monkeypatch):
    monkeypatch.setenv("SENSEAI_HOST", "127.0.0.1")
    import importlib
    import utils
    importlib.reload(utils)
    assert utils.HOST == "127.0.0.1"
```

**Error Testing:**
```python
def test_invalid_action_exits_with_error(self):
    from collect_data import parse_args
    with pytest.raises(SystemExit):
        parse_args(["--actions", "InvalidSign"])
```

**NumPy Array Testing:**
```python
def test_pose_section_zeros(self, mock_results_hands_only):
    keypoints = extract_keypoints(mock_results_hands_only)
    pose = keypoints[0:132]
    assert np.all(pose == 0), "Pose section should be all zeros"
```

**State Machine Testing:**
```python
def test_becomes_stable_after_n_identical(self):
    sf = StabilityFilter(window_size=5, threshold=0.7)
    for _ in range(4):
        result = sf.update("Hello", 0.9)
        assert not result["is_stable"]
    result = sf.update("Hello", 0.9)
    assert result["is_stable"]
```

**Snapshot Testing:** Not used (prefer explicit assertions)

---

*Testing analysis: 2026-02-10*
*Update when test patterns change*
