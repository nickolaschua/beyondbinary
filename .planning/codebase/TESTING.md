# Testing Patterns

**Analysis Date:** 2026-02-10

## Test Framework

**Runner:**
- pytest - Python test framework for both ML and backend
- Run command: `ml/venv/Scripts/python.exe -m pytest ml/tests/`

**Assertion Library:**
- pytest built-in `assert` statements
- No additional assertion libraries

**Run Commands:**
```bash
ml/venv/Scripts/python.exe -m pytest ml/tests/           # Run all ML tests
ml/venv/Scripts/python.exe -m pytest ml/tests/ -v         # Verbose output
ml/venv/Scripts/python.exe -m pytest ml/tests/test_smoke.py  # Single file
ml/venv/Scripts/python.exe -m pytest ml/tests/ -k "test_name" # By name
```

## Test File Organization

**Location:**
- ML tests: `ml/tests/test_*.py` (dedicated tests/ directory, 18+ files, 131+ tests)
- Backend tests: `backend/test_*.py` (root-level, 7 files)
- Root ML tests: `ml/test_setup.py`, `ml/test_ws_client.py`, `ml/test_ws_health.py`

**Naming:**
- `test_*.py` for all test files
- `test_` prefix for all test functions
- Descriptive names: `test_actions_has_10_items`, `test_extract_keypoints_all_landmarks`

**Structure:**
```
ml/
  conftest.py                    # Root config (patches mediapipe)
  test_setup.py                  # Environment verification
  test_ws_client.py              # WebSocket client tests
  test_ws_health.py              # Health endpoint tests
  tests/
    conftest.py                  # Fixtures (MockLandmark, mock_results_*)
    test_augment.py              # Augmentation pipeline
    test_collect_*.py            # Data collection validation
    test_decode_frame*.py        # Frame decoding
    test_extract_keypoints.py    # MediaPipe extraction
    test_load_data.py            # Dataset loading
    test_train_*.py              # Training validation
    test_ws_*.py                 # WebSocket server tests
    test_utils_*.py              # Utility function tests
    test_config.py               # Config/env override tests
    test_smoke.py                # Basic infrastructure checks
    test_verify_cli.py           # CLI verification

backend/
  test_apis.py                   # API endpoint tests
  test_services.py               # Service layer tests
  test_tone_detection.py         # Tone analysis tests
  test_tts_quick.py              # TTS quick tests
  test_config.py                 # Config tests
  test_tone_aggregator.py        # Tone aggregator tests
  test_braille_ueb.py            # Braille translation tests
```

## Test Structure

**Suite Organization:**
```python
# Function-based tests (most common pattern)
def test_actions_has_10_items():
    """Verify ACTIONS list has exactly 10 sign language actions."""
    assert len(ACTIONS) == 10

def test_extract_keypoints_returns_correct_shape(mock_results_all):
    """Keypoints should be a flat array of 1662 floats."""
    keypoints = extract_keypoints(mock_results_all)
    assert keypoints.shape == (1662,)

# Parametrized tests
@pytest.mark.parametrize("action", ACTIONS)
def test_each_action_directory_exists(action):
    """Each action should have a data directory."""
    assert (MP_DATA / action).is_dir()
```

**Patterns:**
- Function-based tests (no class-based test suites)
- Fixtures via `conftest.py` for shared setup
- `@pytest.mark.parametrize` for data-driven tests
- Docstrings on test functions describing intent
- One assertion focus per test

## Mocking

**Framework:**
- pytest fixtures in `conftest.py` files
- `unittest.mock` for patching (`from unittest.mock import patch, MagicMock`)

**Patterns:**
```python
# conftest.py fixture pattern
@pytest.fixture
def mock_results_all():
    """Complete MediaPipe results with all landmarks."""
    results = MagicMock()
    results.pose_landmarks.landmark = [MockLandmark() for _ in range(33)]
    results.left_hand_landmarks.landmark = [MockLandmark() for _ in range(21)]
    results.right_hand_landmarks.landmark = [MockLandmark() for _ in range(21)]
    results.face_landmarks.landmark = [MockLandmark() for _ in range(468)]
    return results

@pytest.fixture
def mock_results_none():
    """Empty MediaPipe results (no detection)."""
    results = MagicMock()
    results.pose_landmarks = None
    results.left_hand_landmarks = None
    results.right_hand_landmarks = None
    results.face_landmarks = None
    return results

# MockLandmark helper class
class MockLandmark:
    """Fake MediaPipe landmark with x, y, z, visibility."""
    def __init__(self, x=0.5, y=0.5, z=0.0, visibility=1.0):
        self.x, self.y, self.z, self.visibility = x, y, z, visibility
```

**What to Mock:**
- MediaPipe results (complex landmark objects)
- TensorFlow model loading and inference
- External API calls (Groq, Hume, ElevenLabs)
- WebSocket connections
- Environment variables

**What NOT to Mock:**
- Pure utility functions (extract_keypoints, augmentation math)
- NumPy array operations
- Constants and configuration values

## Fixtures and Factories

**Test Data:**
```python
# MockLandmark factory (ml/tests/conftest.py)
class MockLandmark:
    def __init__(self, x=0.5, y=0.5, z=0.0, visibility=1.0):
        self.x, self.y, self.z, self.visibility = x, y, z, visibility

# Fixture variants for different detection states
@pytest.fixture
def mock_results_all():      # All landmarks detected
@pytest.fixture
def mock_results_none():     # Nothing detected
@pytest.fixture
def mock_results_hands_only(): # Partial detection
```

**Location:**
- `ml/conftest.py` - Root config (patches mediapipe before imports)
- `ml/tests/conftest.py` - Test fixtures (MockLandmark, mock_results_*)
- Factory patterns inline in test files when simple

## Coverage

**Requirements:**
- No enforced coverage target
- Focus on critical paths: keypoint extraction, model inference, WebSocket protocol, augmentation
- ML module has comprehensive coverage (131+ tests)
- Backend has limited coverage (7 test files, primarily integration)

**View Coverage:**
```bash
ml/venv/Scripts/python.exe -m pytest ml/tests/ --cov=ml --cov-report=html
```

## Test Types

**Unit Tests:**
- Scope: Individual functions in isolation
- Examples: `test_extract_keypoints.py`, `test_augment.py`, `test_utils_*.py`
- Mocking: MediaPipe results via fixtures
- Speed: Fast (<100ms per test)

**Integration Tests:**
- Scope: Component interactions (WebSocket server, service pipelines)
- Examples: `test_ws_*.py` (WebSocket lifespan, timing, rate limiting)
- Mocking: External APIs mocked, internal modules real
- Setup: FastAPI TestClient for HTTP/WebSocket

**Smoke Tests:**
- Scope: Infrastructure verification
- Examples: `test_smoke.py` (ACTIONS count, keypoint shape, model file existence)
- Purpose: Catch configuration/environment issues early

**Configuration Tests:**
- Scope: Environment variable handling
- Examples: `test_config.py` (env var overrides, defaults)
- Mocking: `os.environ` patching

**Type Annotation Tests:**
- Scope: Verify all public functions have type hints
- Examples: `test_utils_types.py`
- Purpose: Enforce type annotation discipline

## Common Patterns

**Fixture-based Testing:**
```python
def test_keypoints_zero_when_no_landmarks(mock_results_none):
    """Missing landmarks should produce zero-filled arrays."""
    keypoints = extract_keypoints(mock_results_none)
    assert np.all(keypoints == 0)
```

**Parametrized Testing:**
```python
@pytest.mark.parametrize("action", ACTIONS)
def test_action_sequences_exist(action):
    """Each action should have at least one sequence directory."""
    action_dir = MP_DATA / action
    sequences = list(action_dir.iterdir())
    assert len(sequences) > 0
```

**Environment Variable Testing:**
```python
def test_config_env_override():
    """Environment variables should override defaults."""
    with patch.dict(os.environ, {"HOST": "0.0.0.0", "PORT": "9999"}):
        # reload config and verify
```

**WebSocket Testing:**
```python
async def test_ws_connection():
    """WebSocket should accept connections and respond."""
    async with httpx.AsyncClient(app=app) as client:
        async with client.websocket_connect("/ws/sign-detection") as ws:
            # send frame, assert response
```

**Snapshot Testing:**
- Not used in this codebase

---

*Testing analysis: 2026-02-10*
*Update when test patterns change*
