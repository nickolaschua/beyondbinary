# Roadmap: SenseAI ML Pipeline

## Overview

Build the complete ASL sign language detection pipeline from environment setup through WebSocket integration. Starts with infrastructure and utilities, moves through data collection and model training, then delivers a production-ready WebSocket server the frontend team can connect to. The final phases handle integration testing and demo polish.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Environment Setup** - Python venv, pinned dependencies, webcam + MediaPipe verification
- [ ] **Phase 2: Utility Functions** - Shared helper functions (extract_keypoints, mediapipe_detection, draw_landmarks)
- [ ] **Phase 3: Data Collection Script** - collect_data.py with webcam recording, resume support, visual feedback
- [ ] **Phase 4: Data Recording** - Record all 10 ASL signs (30 sequences x 30 frames each)
- [ ] **Phase 5: Data Verification** - verify_data.py to confirm hand detection quality before training
- [ ] **Phase 6: Model Training** - Colab notebook: LSTM architecture, training, evaluation, confusion matrix
- [ ] **Phase 7: Real-Time Inference** - test_realtime.py with sliding window, confidence threshold, stability filter
- [ ] **Phase 8: WebSocket Server** - FastAPI ws_server.py receiving base64 frames, returning JSON predictions
- [ ] **Phase 9: Integration Testing** - End-to-end browser frame to prediction, latency tuning, idle detection
- [ ] **Phase 10: Polish & Demo Support** - Confidence tuning, false positive reduction, demo recording support

## Phase Details

### Phase 1: Environment Setup
**Goal**: Working Python 3.11 venv with all pinned dependencies, verified webcam access, MediaPipe Holistic running
**Depends on**: Nothing (first phase)
**Research**: Unlikely (established setup, all versions pinned in .context)
**Plans**: TBD

Plans:
- [ ] 01-01: TBD (run /gsd:plan-phase 1 to break down)

### Phase 2: Utility Functions
**Goal**: Shared `utils.py` with extract_keypoints, mediapipe_detection, draw_landmarks — used by all subsequent scripts
**Depends on**: Phase 1
**Research**: Unlikely (MediaPipe API documented in .context, pattern from reference repos)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Data Collection Script
**Goal**: Working `collect_data.py` that opens webcam, runs MediaPipe Holistic, shows landmarks + status overlay, saves .npy keypoints per frame with resume support
**Depends on**: Phase 2
**Research**: Unlikely (pattern well-understood from nicknochnack/SomyanshAvasthi analysis)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Data Recording
**Goal**: All 10 ASL signs recorded — 30 sequences x 30 frames each in MP_Data/ directory. Hands detected in >80% of frames per sign.
**Depends on**: Phase 3
**Research**: Unlikely (manual webcam recording — watch ASL reference videos, then perform signs)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Data Verification
**Goal**: `verify_data.py` confirms data quality — sequence counts, keypoint shapes, hand detection rates. Any sign with <80% hand detection flagged for re-recording.
**Depends on**: Phase 4
**Research**: Unlikely (simple numpy array inspection)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Model Training
**Goal**: Trained `action_model.h5` with >90% test accuracy. Colab notebook with 3-layer LSTM (tanh), BatchNorm, Dropout, EarlyStopping. Confusion matrix reviewed, no major sign confusions.
**Depends on**: Phase 5
**Research**: Likely (Colab GPU runtime, Keras API compatibility on TF 2.15+)
**Research topics**: TF 2.15 Keras save format (.h5 vs SavedModel), Colab T4 GPU memory for LSTM, batch size tuning for 300 sequences
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: Real-Time Inference
**Goal**: `test_realtime.py` runs sign detection on local webcam — sliding window buffer, confidence threshold (0.7), stability filter (8 consecutive same predictions), probability bar visualization
**Depends on**: Phase 6
**Research**: Unlikely (adapted pattern from reference repos with our improvements)
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

### Phase 8: WebSocket Server
**Goal**: FastAPI `ws_server.py` on port 8001 with `/ws/sign-detection` endpoint. Receives base64 JPEG frames, runs MediaPipe + LSTM, returns JSON predictions. Health check at `/health`.
**Depends on**: Phase 7
**Research**: Likely (WebSocket frame handling, MediaPipe in async context, per-connection state)
**Research topics**: FastAPI WebSocket best practices for long-running ML inference, MediaPipe thread safety with asyncio, handling backpressure when inference is slower than frame arrival
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

### Phase 9: Integration Testing
**Goal**: End-to-end verified: browser sends base64 frames via WebSocket, server returns predictions with <500ms latency. Idle detection working (no hallucinated signs when hands resting). Frame dropping handled gracefully.
**Depends on**: Phase 8
**Research**: Likely (browser-to-WebSocket frame pipeline optimization)
**Research topics**: Base64 JPEG encoding overhead vs raw frames, optimal frame rate (5 vs 10 FPS), WebSocket message queuing under load
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

### Phase 10: Polish & Demo Support
**Goal**: Confidence threshold and stability filter tuned for demo conditions. False positives minimized. Server runs stably for recording sessions. Team supported with demo video recording.
**Depends on**: Phase 9
**Research**: Unlikely (parameter tuning, no new technology)
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Environment Setup | 0/? | Not started | - |
| 2. Utility Functions | 0/? | Not started | - |
| 3. Data Collection Script | 0/? | Not started | - |
| 4. Data Recording | 0/? | Not started | - |
| 5. Data Verification | 0/? | Not started | - |
| 6. Model Training | 0/? | Not started | - |
| 7. Real-Time Inference | 0/? | Not started | - |
| 8. WebSocket Server | 0/? | Not started | - |
| 9. Integration Testing | 0/? | Not started | - |
| 10. Polish & Demo Support | 0/? | Not started | - |
