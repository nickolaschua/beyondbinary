# Codebase Concerns

**Analysis Date:** 2026-02-10

## Tech Debt

**Tightly Coupled Dependency Versions:**
- Issue: MediaPipe 0.10.21 -> numpy<2 -> TensorFlow 2.16.2 version chain
- Files: `ml/requirements.txt`
- Why: MediaPipe 0.10.22+ removed `mp.solutions.holistic` legacy API
- Impact: Cannot upgrade any package in the chain independently; Python 3.13+ may break MediaPipe 0.10.21
- Fix approach: Plan migration to MediaPipe Python SDK (new API) when ready, which removes the version chain constraint

**Manual Test Files Mixed with Source:**
- Issue: 4 manual test scripts (`test_realtime.py`, `test_setup.py`, `test_ws_client.py`, `test_ws_health.py`) live in `ml/` root instead of `ml/tests/`
- Files: `ml/test_realtime.py`, `ml/test_setup.py`, `ml/test_ws_client.py`, `ml/test_ws_health.py`
- Why: Created as standalone scripts before test infrastructure existed
- Impact: Inconsistent test organization; pytest may pick them up unexpectedly
- Fix approach: Move to `ml/tests/manual/` or rename to not match `test_*.py` pattern

**Vendored Code Without Version Tracking:**
- Issue: `vendor/ralph-loop/` has no record of which commit/version was vendored
- Files: `vendor/ralph-loop/`
- Why: Copied manually without version pinning
- Impact: Can't determine if upstream fixes are available
- Fix approach: Add `vendor/VENDORED.md` documenting source, version, and date

## Known Bugs

No confirmed bugs found in current codebase. Previous bugs (race condition, missing error handling, constant duplication) have been resolved per `docs/TODO.md` task completion history.

## Security Considerations

**CORS Configuration (Resolved):**
- ~~Risk: Any website can connect to the WebSocket server~~ — Now configurable via `SENSEAI_CORS_ORIGINS` env var
- Files: `ml/utils.py` (CORS_ORIGINS), `ml/ws_server.py` (line 77)
- Default: `["*"]` (development); set `SENSEAI_CORS_ORIGINS=https://your-frontend.com` for production

**Environment Variable Conversions (Resolved):**
- ~~Risk: Invalid env var values crash server~~ — Now uses `_safe_int()`/`_safe_float()` with fallback defaults
- Files: `ml/utils.py` (lines 39-81)

**Docker Image Uses node:20-slim for Python App:**
- Risk: Unnecessary attack surface from Node.js in a primarily Python ML application
- Files: `Dockerfile` (line 1)
- Current mitigation: Non-root user (`ralph`) for container execution
- Recommendations: Use `python:3.12-slim` as base image if Node.js not needed for Ralph CLI

## Performance Bottlenecks

**Per-Connection MediaPipe Initialization:**
- Problem: Each WebSocket connection creates its own MediaPipe Holistic instance (~100-500MB)
- Files: `ml/ws_server.py` (line 137)
- Measurement: Not profiled, but MediaPipe instances are heavyweight
- Cause: Per-client state isolation pattern
- Improvement path: Consider connection pooling or shared detection service for high concurrency

**Global Model Without Concurrency Control:**
- Problem: Single TensorFlow model shared across concurrent WebSocket connections
- Files: `ml/ws_server.py` (lines 49, 203)
- Measurement: Inference tracked in `deque(maxlen=100)`, warning at >200ms
- Cause: `model.predict()` called directly from async handler without queue
- Improvement path: Request queue or batching for many concurrent clients

**No Frame Batching:**
- Problem: Each frame triggers immediate inference (no amortization)
- Files: `ml/ws_server.py` (lines 200-210)
- Cause: Single-frame-at-a-time processing
- Improvement path: Batch predictions across clients for GPU efficiency (if GPU added)

## Fragile Areas

**MediaPipe Version Constraint:**
- Why fragile: Pinned to 0.10.21 (last version with legacy API); any accidental upgrade breaks everything
- Common failures: `AttributeError: module 'mediapipe.solutions' has no attribute 'holistic'`
- Safe modification: Always test with `ml/conftest.py` mock; never upgrade MediaPipe without migration plan
- Test coverage: Good - conftest patches handle version differences; `test_extract_keypoints.py` validates contract

**Keypoint Vector Order and Size:**
- Why fragile: LSTM model trained on exact 1662-dim vector in [pose, face, lh, rh] order
- Common failures: Changing landmark count or order produces garbage predictions
- Safe modification: Never change `extract_keypoints()` without retraining model
- Test coverage: Good - runtime assertion + dedicated tests in `test_extract_keypoints.py`

## Scaling Limits

**WebSocket Server (Local):**
- Current capacity: Designed for demo/development (single server, no load balancer)
- Limit: Memory-bound by per-connection MediaPipe instances
- Symptoms at limit: High memory usage, slow inference (>200ms threshold)
- Scaling path: Add connection limits, pooled resources, or scale horizontally behind load balancer

## Dependencies at Risk

**mediapipe 0.10.21:**
- Risk: Legacy API removed in 0.10.22+; version may become incompatible with future Python versions
- Impact: Core landmark detection breaks entirely
- Migration plan: Move to MediaPipe Python SDK (new API) when project stabilizes; will require rewriting detection code in `ml/utils.py`

## Missing Critical Features

**No .env.example File:**
- Problem: New developers don't know which environment variables are needed
- Files: Repository root (`.env` exists but is gitignored)
- Current workaround: Must read `docker-compose.yml` and `ml/utils.py` to discover required variables
- Implementation complexity: Low (create single file)

**No Production Deployment Configuration:**
- Problem: No example configs for production deployment (Kubernetes, systemd, etc.)
- Current workaround: Run locally with Uvicorn or Docker Compose
- Blocks: Production deployment requires creating config from scratch
- Implementation complexity: Medium (need to define deployment target first)

## Test Coverage Gaps

**No Concurrent Client Tests:**
- What's not tested: Multiple simultaneous WebSocket connections
- Risk: Concurrency bugs with shared model or per-connection state
- Priority: Medium
- Difficulty to test: Need asyncio test harness simulating 10+ clients

**No End-to-End Pipeline Test:**
- What's not tested: Full data collection -> training -> inference pipeline
- Risk: Breaking changes between pipeline stages undetected
- Priority: Medium
- Difficulty to test: Requires minimal test dataset and automated training

**No Data Quality Regression Tests:**
- What's not tested: Hand detection quality after code changes
- Risk: Subtle detection degradation goes unnoticed
- Priority: Low
- Difficulty to test: Need reference dataset with known detection rates

---

*Concerns audit: 2026-02-10*
*Update as issues are fixed or new ones discovered*
