# External Integrations

**Analysis Date:** 2026-02-10

## APIs & External Services

**Payment Processing:**
- Not applicable (no payment integrations)

**Email/SMS:**
- Not applicable (no messaging integrations)

**External APIs:**
- Google Colab - GPU-accelerated model training
  - Integration method: Jupyter notebook uploaded to Colab (`ml/training_notebook.ipynb`)
  - Auth: Implicit via Colab session (no explicit credentials)
  - Data exchange: Google Drive for uploading/downloading datasets and model artifacts

## Data Storage

**Databases:**
- Not applicable (file-based data storage only)
- Training data: NumPy .npy files in `MP_Data/{action}/{sequence}/{frame}.npy`
- Model artifacts: `models/action_model.h5`, `models/action_model_savedmodel/`

**File Storage:**
- Google Drive - Data and model artifact storage during Colab training
  - SDK/Client: `google.colab.drive` (Colab built-in)
  - Auth: Implicit via Colab session mount
  - Usage: Upload MP_Data.zip, download trained model

**Caching:**
- Not applicable (no caching layer)

## Authentication & Identity

**Auth Provider:**
- Not applicable (no authentication on WebSocket server)
- WebSocket endpoint open on localhost for development

**OAuth Integrations:**
- Not applicable

## Monitoring & Observability

**Error Tracking:**
- Python `logging` module only (`ml/ws_server.py`, `ml/train_model.py`)
- No external error tracking service (Sentry, etc.)

**Analytics:**
- Not applicable

**Logs:**
- stdout/stderr only via Python logging
- TensorBoard logs for training visualization (`logs/{timestamp}/`)

## CI/CD & Deployment

**Hosting:**
- Local development server (Uvicorn on port 8001)
- No cloud deployment configured

**CI Pipeline:**
- Not applicable (no CI/CD pipeline configured)
- Manual test execution via `ml/test_setup.py`, `ml/verify_data.py`

## Environment Configuration

**Development:**
- Required env vars: None (all configuration hardcoded)
- Secrets location: Not applicable (no secrets required for ML pipeline)
- Mock/stub services: Not applicable

**Staging:**
- Not applicable (no staging environment)

**Production:**
- Secrets management: Not applicable
- WebSocket server: Port 8001 with CORS allow-all (needs restriction for production)

## Webhooks & Callbacks

**Incoming:**
- WebSocket endpoint: `ws://localhost:8001/ws/sign-detection` (`ml/ws_server.py`)
  - Protocol: JSON messages with base64-encoded JPEG frames
  - Response: JSON predictions with sign name, confidence, stability flags
  - No signature verification (development mode)

**Outgoing:**
- Not applicable

## Frontend Integration Contract

**Expected Frontend:**
- Framework: Next.js (separate frontend team)
- Video: PeerJS for peer-to-peer video calls
- Connection: `ws://localhost:8001/ws/sign-detection`

**WebSocket Protocol:**
- Client sends: `{"type": "frame", "frame": "<base64 JPEG>"}`
- Server responds (buffering): `{"type": "buffering", "frames_collected": N, "frames_needed": 30, "hands_detected": bool}`
- Server responds (prediction): `{"type": "sign_prediction", "sign": "Hello", "confidence": 0.95, "is_stable": true, "is_new_sign": true, "hands_detected": true, "all_predictions": {...}, "frames_processed": N}`

## Backend Team Services (Separate from ML Pipeline)

The following services are handled by the backend team and are NOT integrated in this ML pipeline:
- Groq Whisper STT (Speech-to-Text)
- Hume AI (Emotion Recognition)
- ElevenLabs TTS (Text-to-Speech)
- Claude API (Jargon Simplification)

---

*Integration audit: 2026-02-10*
*Update when adding/removing external services*
