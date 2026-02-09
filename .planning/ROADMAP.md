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
- [ ] **Phase 12: Consolidate Constants & Config** - Deduplicate constants, centralize config with env var overrides, fix relative MODEL_PATH
- [ ] **Phase 13: Error Handling & Input Validation** - Specific exceptions, data URL validation, payload size limits, model-load safety
- [ ] **Phase 14: Security Hardening** - Fix CORS wildcard+credentials, add frame rate limiting, basic API key auth
- [ ] **Phase 15: Unit Tests** - pytest setup, unit tests for core functions with mocks
- [ ] **Phase 16: Edge Case & Negative Tests** - Invalid inputs, corrupted data, oversized payloads
- [ ] **Phase 17: Performance Instrumentation** - Latency logging, timing middleware, slow-prediction warnings
- [ ] **Phase 18: Protocol Docs & Modernization** - WebSocket schema docs, FastAPI lifespan migration

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
**Research**: Unlikely (internal refactoring, Python stdlib)
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

#### Phase 13: Error Handling & Input Validation
**Goal**: WebSocket server uses specific exception types (binascii.Error, cv2.error, ValueError) instead of bare `except Exception`. Data URL parsing validated before split. Payload size limit enforced (max 5MB). Model file existence checked at startup with clear error message.
**Depends on**: Phase 12
**Research**: Unlikely (standard Python error handling patterns)
**Plans**: TBD

Plans:
- [ ] 13-01: TBD

#### Phase 14: Security Hardening
**Goal**: CORS restricted to frontend domain (no wildcard+credentials). Per-client frame rate limiting (max 60 frames per 10 seconds). Basic API key validation on WebSocket connect.
**Depends on**: Phase 13
**Research**: Likely (FastAPI WebSocket auth patterns, rate limiting middleware options)
**Research topics**: FastAPI WebSocket authentication best practices, starlette rate limiting, per-connection state for rate tracking
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

#### Phase 15: Unit Tests
**Goal**: pytest configured with test fixtures. Unit tests for `extract_keypoints()`, `decode_frame()`, `mediapipe_detection()` using mocks. Contract test for (1662,) keypoint shape. All tests pass in CI-compatible mode (no webcam required).
**Depends on**: Phase 13
**Research**: Unlikely (pytest is established, functions are pure or easily mockable)
**Plans**: TBD

Plans:
- [ ] 15-01: TBD

#### Phase 16: Edge Case & Negative Tests
**Goal**: Tests for invalid input formats, corrupted base64 data, oversized payloads, malformed WebSocket messages. Server handles all gracefully without crashing.
**Depends on**: Phase 15
**Research**: Unlikely (standard test patterns with fixtures)
**Plans**: TBD

Plans:
- [ ] 16-01: TBD

#### Phase 17: Performance Instrumentation
**Goal**: Timing around MediaPipe detection and LSTM inference in WebSocket server. Slow prediction logging (>200ms). Per-request latency metrics available at `/health` endpoint.
**Depends on**: Phase 13
**Research**: Unlikely (Python timing/logging, existing FastAPI patterns)
**Plans**: TBD

Plans:
- [ ] 17-01: TBD

#### Phase 18: Protocol Docs & Modernization
**Goal**: WebSocket message schema documented (connection lifecycle, request/response formats, error codes). FastAPI `@app.on_event("startup")` replaced with lifespan handlers. Runtime keypoint shape assertion added.
**Depends on**: Phase 17
**Research**: Likely (FastAPI lifespan API current best practices)
**Research topics**: FastAPI lifespan context manager pattern, asynccontextmanager usage with model loading
**Plans**: TBD

Plans:
- [ ] 18-01: TBD

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
| 12. Consolidate Constants & Config | v1.1 | 0/? | Not started | - |
| 13. Error Handling & Input Validation | v1.1 | 0/? | Not started | - |
| 14. Security Hardening | v1.1 | 0/? | Not started | - |
| 15. Unit Tests | v1.1 | 0/? | Not started | - |
| 16. Edge Case & Negative Tests | v1.1 | 0/? | Not started | - |
| 17. Performance Instrumentation | v1.1 | 0/? | Not started | - |
| 18. Protocol Docs & Modernization | v1.1 | 0/? | Not started | - |
