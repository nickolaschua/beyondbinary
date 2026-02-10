# Project Milestones: SenseAI ML Pipeline

## v1.1 Refinement & Testing (Shipped: 2026-02-10)

**Delivered:** Resolved dependency conflicts, hardened the pipeline with security, testing, and instrumentation, and documented the WebSocket protocol for frontend integration.

**Phases completed:** 11-18 (3 GSD plans, 5 phases pre-GSD)

**Key accomplishments:**

- Resolved Python dependency hell: pinned mediapipe 0.10.21 (last version with mp.solutions.holistic), tensorflow 2.16.2, numpy 1.26.4
- Added configurable CORS, safe env var parsing, and optional API key authentication
- 131+ automated tests (21 test files) covering core functions, edge cases, and security
- Performance instrumentation with inference timing and /health endpoint
- Complete WebSocket protocol documentation (docs/WEBSOCKET.md) enabling frontend integration without reading source

**Stats:**

- 18 files created/modified (in GSD commits)
- 3,715 lines of Python
- 8 phases, 3 plans, 8 tasks
- 1 day from start to ship

**Git range:** `e8c4c95` (codebase map) → `6702644` (18-01 docs)

**What's next:** Milestone complete — all planned refinement and testing work done.

---

## v1.0 MVP (Shipped: 2026-02-10)

**Delivered:** Complete ASL sign language detection pipeline from environment setup through WebSocket integration — 10 signs detected in real-time from webcam via MediaPipe + LSTM.

**Phases completed:** 1-10 (all pre-GSD)

**Key accomplishments:**

- Data collection pipeline with webcam capture, resume support, visual feedback
- Trained 3-layer LSTM model (tanh, BatchNorm, Dropout) with >90% test accuracy on 10 ASL signs
- Real-time inference with sliding window, confidence threshold (0.7), stability filter (8 consecutive)
- FastAPI WebSocket server on port 8001 receiving base64 frames, returning JSON predictions
- Integration tested end-to-end: browser frame → prediction with latency tuning

**Stats:**

- 10 phases completed (pre-GSD, via agent branches)
- Full pipeline: collect → verify → train → infer → serve

**Git range:** `acfeee2` (init) → `60c1116` (merge PR #1)

**What's next:** v1.1 Refinement & Testing

---
