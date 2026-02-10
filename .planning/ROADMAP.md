# Roadmap: SenseAI ML Pipeline

## Overview

Build the complete ASL sign language detection pipeline from environment setup through WebSocket integration. Starts with infrastructure and utilities, moves through data collection and model training, then delivers a production-ready WebSocket server the frontend team can connect to. The final phases handle integration testing and demo polish.

## Domain Expertise

None

## Milestones

- ✅ **v1.0 MVP** - Phases 1-10 (shipped 2026-02-10)
- 🚧 **v1.1 Refinement & Testing** - Phases 11-18 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>✅ v1.0 MVP (Phases 1-10) - SHIPPED 2026-02-10</summary>

- [x] **Phase 1: Environment Setup** - Python venv, pinned dependencies, webcam + MediaPipe verification
- [x] **Phase 2: Utility Functions** - Shared helper functions (extract_keypoints, mediapipe_detection, draw_landmarks)
- [x] **Phase 3: Data Collection Script** - collect_data.py with webcam recording, resume support, visual feedback
- [x] **Phase 4: Data Recording** - Record all 10 ASL signs (30 sequences x 30 frames each)
- [x] **Phase 5: Data Verification** - verify_data.py to confirm hand detection quality before training
- [x] **Phase 6: Model Training** - Colab notebook: LSTM architecture, training, evaluation, confusion matrix
- [x] **Phase 7: Real-Time Inference** - test_realtime.py with sliding window, confidence threshold, stability filter
- [x] **Phase 8: WebSocket Server** - FastAPI ws_server.py receiving base64 frames, returning JSON predictions
- [x] **Phase 9: Integration Testing** - End-to-end browser frame to prediction, latency tuning, idle detection
- [x] **Phase 10: Polish & Demo Support** - Confidence tuning, false positive reduction, demo recording support

### Phase 1: Environment Setup
**Goal**: Working Python 3.11 venv with all pinned dependencies, verified webcam access, MediaPipe Holistic running
**Depends on**: Nothing (first phase)
**Plans**: Completed (pre-GSD)

### Phase 2: Utility Functions
**Goal**: Shared `utils.py` with extract_keypoints, mediapipe_detection, draw_landmarks
**Depends on**: Phase 1
**Plans**: Completed (pre-GSD)

### Phase 3: Data Collection Script
**Goal**: Working `collect_data.py` with webcam recording, resume support, visual feedback
**Depends on**: Phase 2
**Plans**: Completed (pre-GSD)

### Phase 4: Data Recording
**Goal**: All 10 ASL signs recorded — 30 sequences x 30 frames each in MP_Data/
**Depends on**: Phase 3
**Plans**: Completed (pre-GSD)

### Phase 5: Data Verification
**Goal**: `verify_data.py` confirms data quality — sequence counts, keypoint shapes, hand detection rates
**Depends on**: Phase 4
**Plans**: Completed (pre-GSD)

### Phase 6: Model Training
**Goal**: Trained `action_model.h5` with >90% test accuracy. 3-layer LSTM with BatchNorm, Dropout, EarlyStopping
**Depends on**: Phase 5
**Plans**: Completed (pre-GSD)

### Phase 7: Real-Time Inference
**Goal**: `test_realtime.py` with sliding window, confidence threshold, stability filter
**Depends on**: Phase 6
**Plans**: Completed (pre-GSD)

### Phase 8: WebSocket Server
**Goal**: FastAPI `ws_server.py` on port 8001 with `/ws/sign-detection` endpoint
**Depends on**: Phase 7
**Plans**: Completed (pre-GSD)

### Phase 9: Integration Testing
**Goal**: End-to-end verified: browser sends base64 frames, server returns predictions
**Depends on**: Phase 8
**Plans**: Completed (pre-GSD)

### Phase 10: Polish & Demo Support
**Goal**: Confidence threshold and stability filter tuned for demo conditions
**Depends on**: Phase 9
**Plans**: Completed (pre-GSD)

</details>

### 🚧 v1.1 Refinement & Testing (In Progress)

**Milestone Goal:** Resolve dependency hell, harden the pipeline against edge cases and security issues, add proper test coverage, and instrument for performance monitoring.

- [x] **Phase 11: Dependency Resolution** - Python 3.12 venv, pinned requirements install, full import + MediaPipe verification
- [x] **Phase 12: Consolidate Constants & Config** - Deduplicate constants, centralize config with env var overrides, fix relative MODEL_PATH *(completed by Ralph loop pre-GSD)*
- [x] **Phase 13: Error Handling & Input Validation** - Specific exceptions, data URL validation, payload size limits, model-load safety *(completed by Ralph loop pre-GSD)*
- [x] **Phase 14: Security Hardening** - CORS origin restriction, env var validation, optional API key auth
- [x] **Phase 15: Unit Tests** - pytest setup, unit tests for core functions with mocks *(completed by Ralph loop — 21 files, 114+ tests)*
- [x] **Phase 16: Edge Case & Negative Tests** - Invalid inputs, corrupted data, oversized payloads *(completed by Ralph loop — test_decode_frame_hardened.py etc.)*
- [x] **Phase 17: Performance Instrumentation** - Latency logging, timing middleware, slow-prediction warnings *(completed by Ralph loop — inference_times deque, /health endpoint)*
- [ ] **Phase 18: Protocol Docs & Modernization** - WebSocket message schema documentation

#### Phase 11: Dependency Resolution
**Goal**: Working Python 3.12 venv with all pinned dependencies installed and verified. MediaPipe, TensorFlow, OpenCV all import cleanly. Webcam + MediaPipe Holistic detection confirmed working. All existing scripts run without import errors.
**Depends on**: Previous milestone complete
**Research**: Unlikely (Python 3.12 already installed, mediapipe resolves on 3.12, all versions pinned)
**Plans**: 1/1 complete

Plans:
- [x] 11-01: Create venv, install deps, verify environment, update PROJECT.md

#### Phase 12: Consolidate Constants & Config
**Goal**: Single source of truth for ACTIONS, SEQUENCE_LENGTH, NUM_SEQUENCES in `ml/utils.py`. HOST, PORT, CONFIDENCE_THRESHOLD, STABILITY_WINDOW centralized with environment variable overrides. MODEL_PATH uses absolute path resolution.
**Depends on**: Phase 11
**Status**: Complete (implemented by Ralph loop pre-GSD)
**Evidence**: `ml/utils.py` lines 25-41 — all constants centralized, env var overrides via `SENSEAI_*`, `MODEL_PATH` uses `os.path.abspath(__file__)`. `ml/ws_server.py` imports all from `utils`.
**Plans**: 0/0 (no plans needed — work was done pre-GSD)

#### Phase 13: Error Handling & Input Validation
**Goal**: WebSocket server uses specific exception types (binascii.Error, cv2.error, ValueError) instead of bare `except Exception`. Data URL parsing validated before split. Payload size limit enforced (max 5MB). Model file existence checked at startup with clear error message.
**Depends on**: Phase 12
**Status**: Complete (implemented by Ralph loop pre-GSD)
**Evidence**: `ml/ws_server.py` `decode_frame()` — 5MB limit (line 103), data URL comma check (line 109), `binascii.Error`/`ValueError` catches (line 118). Lifespan checks `os.path.isfile(MODEL_PATH)` (line 59).
**Plans**: 0/0 (no plans needed — work was done pre-GSD)

#### Phase 14: Security Hardening
**Goal**: Restrict CORS to configurable allowed origins (no wildcard+credentials). Add try/except validation for env var type conversions. Optional API key auth on WebSocket connect.
**Depends on**: Phase 13
**Already done**: Per-client frame rate limiting (60 frames/10s) in `ws_server.py` lines 159-162
**Remaining work**: (1) CORS origin restriction via `SENSEAI_CORS_ORIGINS` env var, (2) env var validation with fallback for invalid values, (3) optional `SENSEAI_API_KEY` check on WebSocket connect
**Research**: Unlikely (straightforward FastAPI patterns)
**Plans**: 1/1 complete

Plans:
- [x] 14-01: Env var validation, configurable CORS origins, optional API key auth

#### Phase 15: Unit Tests
**Goal**: pytest configured with test fixtures. Unit tests for `extract_keypoints()`, `decode_frame()`, `mediapipe_detection()` using mocks. Contract test for (1662,) keypoint shape. All tests pass in CI-compatible mode (no webcam required).
**Depends on**: Phase 13
**Status**: Complete (implemented by Ralph loop pre-GSD)
**Evidence**: `ml/tests/` — 21 test files, 114+ tests. `conftest.py` at two levels with MediaPipe mocking. `test_extract_keypoints.py` validates 1662 shape contract. All tests run without webcam/GPU.
**Plans**: 0/0 (no plans needed — work was done pre-GSD)

#### Phase 16: Edge Case & Negative Tests
**Goal**: Tests for invalid input formats, corrupted base64 data, oversized payloads, malformed WebSocket messages. Server handles all gracefully without crashing.
**Depends on**: Phase 15
**Status**: Complete (implemented by Ralph loop pre-GSD)
**Evidence**: `ml/tests/test_decode_frame_hardened.py` — URL prefix, oversized payload, empty input. `test_ws_server.py` — invalid JSON, unknown message types. `test_ws_rate_limit.py` — rate limiting edge cases.
**Plans**: 0/0 (no plans needed — work was done pre-GSD)

#### Phase 17: Performance Instrumentation
**Goal**: Timing around MediaPipe detection and LSTM inference in WebSocket server. Slow prediction logging (>200ms). Per-request latency metrics available at `/health` endpoint.
**Depends on**: Phase 13
**Status**: Complete (implemented by Ralph loop pre-GSD)
**Evidence**: `ml/ws_server.py` — `inference_times = deque(maxlen=100)` (line 52), `time.perf_counter()` around detection+prediction (lines 179-206), `>200ms` warning (lines 208-209), `/health` returns `avg_inference_ms` (line 84).
**Plans**: 0/0 (no plans needed — work was done pre-GSD)

#### Phase 18: Protocol Docs & Modernization
**Goal**: WebSocket message schema documented (connection lifecycle, request/response formats, error codes).
**Depends on**: Phase 14
**Already done**: FastAPI lifespan context manager (`ws_server.py` lines 55-67). Runtime keypoint shape assertion (`utils.py` line 156).
**Remaining work**: WebSocket protocol documentation (message types, JSON schemas, error codes, connection lifecycle)
**Research**: Unlikely (documenting existing behavior)
**Plans**: 0/1

Plans:
- [ ] 18-01: WebSocket protocol documentation (docs/WEBSOCKET.md)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → ... → 10 → 11 → 12 → ... → 18

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Environment Setup | v1.0 | -/- | Complete | 2026-02-09 |
| 2. Utility Functions | v1.0 | -/- | Complete | 2026-02-09 |
| 3. Data Collection Script | v1.0 | -/- | Complete | 2026-02-09 |
| 4. Data Recording | v1.0 | -/- | Complete | 2026-02-09 |
| 5. Data Verification | v1.0 | -/- | Complete | 2026-02-09 |
| 6. Model Training | v1.0 | -/- | Complete | 2026-02-09 |
| 7. Real-Time Inference | v1.0 | -/- | Complete | 2026-02-09 |
| 8. WebSocket Server | v1.0 | -/- | Complete | 2026-02-09 |
| 9. Integration Testing | v1.0 | -/- | Complete | 2026-02-09 |
| 10. Polish & Demo Support | v1.0 | -/- | Complete | 2026-02-09 |
| 11. Dependency Resolution | v1.1 | 1/1 | Complete | 2026-02-10 |
| 12. Consolidate Constants & Config | v1.1 | 0/0 | Complete (pre-GSD) | 2026-02-10 |
| 13. Error Handling & Input Validation | v1.1 | 0/0 | Complete (pre-GSD) | 2026-02-10 |
| 14. Security Hardening | v1.1 | 1/1 | Complete | 2026-02-10 |
| 15. Unit Tests | v1.1 | 0/0 | Complete (pre-GSD) | 2026-02-10 |
| 16. Edge Case & Negative Tests | v1.1 | 0/0 | Complete (pre-GSD) | 2026-02-10 |
| 17. Performance Instrumentation | v1.1 | 0/0 | Complete (pre-GSD) | 2026-02-10 |
| 18. Protocol Docs & Modernization | v1.1 | 0/1 | Not started | - |
