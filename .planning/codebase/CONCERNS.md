# Codebase Concerns

**Analysis Date:** 2026-02-10

## Tech Debt

**Bare exception handling in WebSocket server:**
- Issue: `except Exception:` catches all errors without distinguishing types in frame decoding
- Files: `ml/ws_server.py` (line 127)
- Why: Quick hackathon implementation
- Impact: Cannot diagnose root cause of frame decode failures; generic error messages to clients
- Fix approach: Use specific exception types (binascii.Error, cv2.error, ValueError)

**Duplicate constants across files:**
- Issue: ACTIONS, SEQUENCE_LENGTH, NUM_SEQUENCES defined in 3 separate files
- Files: `ml/utils.py` (lines 23-31), `ml/train_model.py` (lines 48-54), `ml/verify_data.py` (lines 22-26)
- Why: `verify_data.py` intentionally standalone; `train_model.py` duplicates for clarity
- Impact: If ACTIONS changes, must update 3 files; risk of inconsistent state
- Fix approach: Import from `ml/utils.py` in all files; remove standalone requirement from verify_data.py

**Hardcoded configuration in multiple files:**
- Issue: HOST, PORT, CONFIDENCE_THRESHOLD, STABILITY_WINDOW hardcoded in 3+ files
- Files: `ml/ws_server.py` (lines 37-40), `ml/test_realtime.py` (lines 30-31), `ml/test_ws_client.py` (line 25), `ml/test_ws_health.py` (line 14)
- Why: Hackathon simplicity
- Impact: Cannot deploy to different ports without code changes; tuning requires editing source
- Fix approach: Centralize in `ml/utils.py` with environment variable overrides

**Relative MODEL_PATH depends on working directory:**
- Issue: `MODEL_PATH = os.path.join('models', 'action_model.h5')` is relative to cwd
- Files: `ml/utils.py` (line 31)
- Why: Simple default for single-directory usage
- Impact: Different behavior depending on where script is executed from; confusing errors
- Fix approach: Use `os.path.dirname(os.path.abspath(__file__))` for absolute path resolution

## Known Bugs

**No known bugs in current codebase.**
- All pipeline phases (1-10) have been implemented and tested
- WebSocket server functional for single-client scenarios

## Security Considerations

**CORS wildcard with credentials enabled:**
- Risk: `allow_origins=["*"]` with `allow_credentials=True` allows any website to make authenticated requests
- File: `ml/ws_server.py` (lines 49-55)
- Current mitigation: Localhost-only development (not exposed to internet)
- Recommendations: Restrict CORS to frontend domain; set `allow_credentials=False` with wildcard origins

**No rate limiting on WebSocket connections:**
- Risk: Client can send unlimited frames, exhausting server resources (DoS)
- File: `ml/ws_server.py` (lines 91-202)
- Current mitigation: None (localhost development only)
- Recommendations: Add per-client frame rate limiting (e.g., max 60 frames per 10 seconds)

**No payload size limit on base64 decode:**
- Risk: Client sends oversized base64 string causing memory exhaustion
- File: `ml/ws_server.py` (lines 85-86)
- Current mitigation: None
- Recommendations: Validate payload size before decoding (e.g., max 5 MB)

**Unsafe data URL prefix parsing:**
- Risk: Malformed data URL (e.g., `"data:image/jpeg;base64"` without comma) causes IndexError or processes garbage
- File: `ml/ws_server.py` (lines 82-83)
- Current mitigation: None
- Recommendations: Validate comma separator exists before splitting

## Performance Bottlenecks

**No latency logging in inference path:**
- Problem: No timing around `model.predict()` calls in WebSocket server
- File: `ml/ws_server.py` (line 158)
- Measurement: Not tracked (no instrumentation)
- Cause: No performance monitoring implemented
- Improvement path: Add timing around MediaPipe detection and LSTM inference; log slow predictions

## Fragile Areas

**Keypoint extraction contract (`ml/utils.py`):**
- Why fragile: All downstream scripts depend on exact (1662,) shape and [pose, face, lh, rh] order
- Common failures: Changing keypoint order silently breaks all inference
- Safe modification: Add runtime assertion that result.shape == (1662,)
- Test coverage: Verified by `ml/test_setup.py` (shape check only)

**WebSocket server startup model loading:**
- Why fragile: No error handling if MODEL_PATH doesn't exist; server crashes with cryptic TensorFlow error
- File: `ml/ws_server.py` (lines 62-66)
- Common failures: Missing model file, wrong working directory
- Safe modification: Add os.path.isfile() check and clear error message before tf.keras.models.load_model()
- Test coverage: `ml/test_ws_health.py` checks /health endpoint but only after successful startup

## Scaling Limits

**Single-connection WebSocket handling:**
- Current capacity: Designed and tested for single client at a time
- Limit: Multiple concurrent clients create per-connection MediaPipe instances (CPU-intensive)
- Symptoms at limit: Increased inference latency, potential memory pressure
- Scaling path: Connection pooling, model optimization, or GPU inference

## Dependencies at Risk

**No dependencies at immediate risk.**
- All packages pinned to specific versions in `ml/requirements.txt`
- TensorFlow 2.20.0, MediaPipe 0.10.32, FastAPI 0.128.6 are current stable versions
- Note: `@app.on_event("startup")` in FastAPI is deprecated in favor of lifespan handlers

## Missing Critical Features

**No WebSocket authentication:**
- Problem: Any client can connect and send frames without authentication
- Current workaround: Localhost-only development
- Blocks: Production deployment to public internet
- Implementation complexity: Low (add API key or JWT validation on WebSocket connect)

**No protocol specification document:**
- Problem: WebSocket message format only documented in code comments and test clients
- Current workaround: Frontend team reverse-engineers from `ml/test_ws_client.py`
- Blocks: Efficient frontend integration
- Implementation complexity: Low (document JSON message schemas)

## Test Coverage Gaps

**No unit tests for core functions:**
- What's not tested: `extract_keypoints()`, `decode_frame()`, `mediapipe_detection()` in isolation
- Risk: Refactoring could silently break core logic without detection
- Priority: Medium
- Difficulty to test: Low (functions are pure or easily mockable)

**No negative/edge case testing:**
- What's not tested: Invalid input formats, corrupted data, oversized payloads, concurrent clients
- Risk: Server crashes or produces incorrect results on unexpected input
- Priority: Medium (especially for production deployment)
- Difficulty to test: Medium (requires mocking and test fixtures)

**No automated WebSocket integration tests:**
- What's not tested: End-to-end WebSocket flow without manual intervention
- Risk: Regressions in server protocol undetected until manual testing
- Priority: Low (hackathon context)
- Difficulty to test: Medium (requires programmatic server startup and client)

---

*Concerns audit: 2026-02-10*
*Update as issues are fixed or new ones discovered*
