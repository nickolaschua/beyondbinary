# Roadmap: SenseAI ML Pipeline

## Overview

Build the complete ASL sign language detection pipeline from environment setup through WebSocket integration. Starts with infrastructure and utilities, moves through data collection and model training, then delivers a production-ready WebSocket server the frontend team can connect to. The final phases handle integration testing and demo polish.

## Domain Expertise

None

## Milestones

- ✅ **v1.0 MVP** - Phases 1-10 (shipped 2026-02-10)
- ✅ **v1.1 Refinement & Testing** - Phases 11-18 (shipped 2026-02-10)

## Completed Milestones

- ✅ [v1.0 MVP](milestones/v1.0-ROADMAP.md) (Phases 1-10) — SHIPPED 2026-02-10
- ✅ [v1.1 Refinement & Testing](milestones/v1.1-ROADMAP.md) (Phases 11-18) — SHIPPED 2026-02-10

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

</details>

<details>
<summary>✅ v1.1 Refinement & Testing (Phases 11-18) - SHIPPED 2026-02-10</summary>

- [x] **Phase 11: Dependency Resolution** - Python 3.12 venv, pinned requirements install, full import + MediaPipe verification
- [x] **Phase 12: Consolidate Constants & Config** - Deduplicate constants, centralize config with env var overrides, fix relative MODEL_PATH *(completed by Ralph loop pre-GSD)*
- [x] **Phase 13: Error Handling & Input Validation** - Specific exceptions, data URL validation, payload size limits, model-load safety *(completed by Ralph loop pre-GSD)*
- [x] **Phase 14: Security Hardening** - CORS origin restriction, env var validation, optional API key auth
- [x] **Phase 15: Unit Tests** - pytest setup, unit tests for core functions with mocks *(completed by Ralph loop — 21 files, 114+ tests)*
- [x] **Phase 16: Edge Case & Negative Tests** - Invalid inputs, corrupted data, oversized payloads *(completed by Ralph loop — test_decode_frame_hardened.py etc.)*
- [x] **Phase 17: Performance Instrumentation** - Latency logging, timing middleware, slow-prediction warnings *(completed by Ralph loop — inference_times deque, /health endpoint)*
- [x] **Phase 18: Protocol Docs & Modernization** - WebSocket message schema documentation

</details>

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
| 18. Protocol Docs & Modernization | v1.1 | 1/1 | Complete | 2026-02-10 |
