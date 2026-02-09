# SenseAI — ML Pipeline

## What This Is

The sign language detection pipeline for SenseAI, a hackathon accessibility app. Takes webcam video frames, extracts body/hand/face landmarks via MediaPipe Holistic, classifies 30-frame sequences of landmarks into ASL signs using a Keras LSTM, and serves predictions over a FastAPI WebSocket endpoint for the frontend team to consume.

## Core Value

A working, reliable sign detection pipeline that the frontend can connect to — signs performed on webcam must appear as text predictions in the browser with minimal latency and few false positives.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Data collection script (`collect_data.py`) — webcam to MediaPipe Holistic to .npy keypoint sequences for 10 ASL signs
- [ ] Trained LSTM model (`action_model.h5`) — 3-layer LSTM, tanh activation, >90% test accuracy on 10 signs
- [ ] Real-time inference (`test_realtime.py`) — standalone webcam sign detection with confidence threshold + stability filtering
- [ ] WebSocket server (`ws_server.py`) — FastAPI endpoint at `/ws/sign-detection` receiving base64 frames, returning JSON predictions
- [ ] Data verification script (`verify_data.py`) — confirms hand detection quality before training
- [ ] Frontend integration protocol — documented message format for Frontend 2 team to connect

### Out of Scope

- Frontend (Next.js, Tailwind, PeerJS video call) — Frontend team handles this
- Main backend (FastAPI conversation endpoints, Groq Whisper STT, Hume AI, ElevenLabs TTS, Claude jargon simplification) — Backend lead handles this
- Deployment to Railway/Vercel — other team members
- Multiple sign languages — ASL only
- More than 10-15 signs — vocabulary is Hello, Thank You, Help, Yes, No, Please, Sorry, I Love You, Stop, More (expand to 15 if time permits)
- Pre-trained model fine-tuning — training from scratch is faster and more accurate for custom signs

## Context

**Hackathon:** Beyond Binary, 48-hour sprint, 5-person team. Pre-recorded video submission.

**ML Lead role:** Build the full sign detection pipeline from data collection through WebSocket integration. This is the "wow factor" for the demo — sign language on video call converted to text/speech in real time.

**Reference implementations researched:**
- **nicknochnack/ActionDetectionforSignLanguage** — Nicholas Renotte's original. 3 signs (hello, thanks, iloveyou), MediaPipe Holistic + 3-layer LSTM (64→128→64, relu), 2000 epochs, confidence threshold 0.8, no stability filter. Ships `action.h5`. Keypoint order: `[pose, face, lh, rh]`.
- **SomyanshAvasthi/Sign-Language-Detection-using-MediaPipe** — Cleaned-up derivative. Same architecture but adds 10-frame temporal stability filter, updated MediaPipe API (`FACEMESH_CONTOURS`), 330 epochs, lower threshold (0.5). Has a bug evaluating on X_train instead of X_test.
- **SLRNet (Khushi-739)** — June 2025 paper. 26 ASL letters + 10 words, 86.7% accuracy. Same MediaPipe + LSTM pipeline.

**Key finding:** Neither pre-trained `.h5` is worth fine-tuning. Both trained on only 3 signs/90 sequences — weights are too narrow. The LSTM trains in ~10 min on Colab GPU, so training from scratch on our 10 signs is faster and more accurate. The value from these repos is the pipeline architecture, not the weights.

**Our architecture improvements over the reference repos:**
- `tanh` activation for LSTM layers (better than relu for LSTM gate structure)
- BatchNormalization + Dropout (0.2) after each LSTM layer (regularization)
- EarlyStopping + ModelCheckpoint callbacks (prevent overfitting)
- Confidence threshold (0.7) + stability filter (8 consecutive same predictions)
- Proper train/test split with stratification
- Per-connection MediaPipe instance in WebSocket server

**10 ASL signs chosen** (visually distinct, contextually relevant):
Hello, Thank You, Help, Yes, No, Please, Sorry, I Love You, Stop, More

## Constraints

- **Platform**: Windows, no local GPU — training must happen on Google Colab (T4 GPU)
- **Python**: 3.12 — MediaPipe 0.10.32 supports 3.9-3.12, system Python 3.13 not compatible
- **Runtime**: Python 3.12 venv at ml/venv/ (created via `py -3.12 -m venv ml/venv`)
- **Dependencies**: numpy 2.4.2, opencv-python 4.13.0.92, mediapipe 0.10.32, tensorflow 2.20.0, fastapi 0.128.6 (see ml/requirements.txt for full list)
- **Data format**: 30 frames x 1662 features per sequence. Keypoint order: `[pose, face, lh, rh]` (matching nicknochnack convention and .context spec)
- **WebSocket server**: FastAPI on port 8001, separate from main backend on port 8000
- **Integration contract**: Frontend sends `{type: "frame", frame: "<base64 jpeg>"}`, server returns `{type: "sign_prediction", sign: "Hello", confidence: 0.95, is_new_sign: true, hands_detected: true}`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Train from scratch, don't fine-tune existing models | Reference repos trained on 3 signs/90 sequences — weights too narrow. LSTM trains in ~10 min on Colab anyway | -- Pending |
| Use tanh activation for LSTM layers | tanh outputs [-1, 1] matching LSTM internal gate structure. relu can cause dying neurons in recurrent layers. Both .context spec and ML literature agree | -- Pending |
| Keep [pose, face, lh, rh] keypoint order | Matches nicknochnack convention and .context spec. SomyanshAvasthi uses different order — models not interchangeable | -- Pending |
| Adopt SomyanshAvasthi's stability filter approach | 10-frame prediction consensus reduces flickering/false positives. Better than nicknochnack's single-frame threshold check | -- Pending |
| Separate WebSocket server on port 8001 | Simpler for hackathon — no coordination needed with backend lead's FastAPI app. Frontend connects to both ports | -- Pending |

---
*Last updated: 2026-02-09 after initialization*
