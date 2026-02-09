# SenseAI — Beyond Binary Hackathon Sprint Plan
## 5-Person Team | 48 Hours | Pre-Recorded Video Submission

---

## What You're Building (Final Scope)

SenseAI is an adaptive accessibility companion with **two conversation modes** and a **profile-driven channel system** that switches the entire UI based on the user's ability profile.

### Mode 1: Sign Language Video Call (Deaf ↔ Hearing/Blind)
A deaf user signs ASL on a video call. The app detects signs via MediaPipe + LSTM, converts to text, and speaks aloud via TTS for the other participant. The hearing participant speaks, and their speech appears as captions with emotion/tone badges for the deaf user.

### Mode 2: In-Person Conversation Intelligence (Deaf or Blind in a face-to-face setting)
A deaf user is at a doctor's appointment. The app listens to the doctor's speech, displays live captions with tone annotations and jargon simplification, and provides quick-reply buttons. When the deaf user taps a quick-reply, the app speaks it aloud naturally. A blind user in the same scenario hears contextual audio summaries through earbuds.

### Profile System
Two profiles: **Deaf** and **Visually Impaired**. Selected during a 2-screen onboarding flow. The profile determines:
- Deaf → all output is visual (captions, cards, vibration). Input is touch/sign/camera. Audio output is OFF for self, ON for speaking to others.
- Visually Impaired → all output is audio (TTS through earbuds). Input is voice. Screen is minimal/off.

### Emotion Layer (runs across both modes)
- Voice emotion: Hume AI speech prosody → tone badges on captions ("speaking carefully", "sounds frustrated")
- Facial emotion: Hume AI facial expression → emotion indicators on video call
- Both are API calls, no custom ML needed.

---

## What's CUT (confirmed)

- ❌ GPS / Google Places API environmental awareness
- ❌ Cognitive impairment simplified cards (3rd profile)
- ❌ PostgreSQL + pgvector persistent context/memory
- ❌ Camera on-demand (reading menus, forms, signs)
- ❌ Multiple sign languages (ASL only)
- ❌ Full routing engine (hardcoded 2-profile switch instead)
- ❌ Post-conversation summary with calendar/reminder integration
- ❌ Ambient sound classification (PA announcements, alarms, etc.)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Next.js PWA)                     │
│                                                                   │
│  ┌─────────────┐    ┌──────────────────────────────────────────┐ │
│  │  ONBOARDING  │    │           MAIN APP                       │ │
│  │  2 screens   │    │                                          │ │
│  │  Sets profile│───▶│  Profile Context (React Context)         │ │
│  │  deaf/blind  │    │       │                                  │ │
│  └─────────────┘    │       ▼                                  │ │
│                      │  ┌──────────┐    ┌───────────────┐      │ │
│                      │  │ MODE 1   │    │   MODE 2      │      │ │
│                      │  │ Video    │    │   In-Person   │      │ │
│                      │  │ Call     │    │   Conversation│      │ │
│                      │  │          │    │               │      │ │
│                      │  │ PeerJS   │    │  "Listen"     │      │ │
│                      │  │ WebRTC   │    │   mode        │      │ │
│                      │  │          │    │               │      │ │
│                      │  │ Local    │    │  Web Speech   │      │ │
│                      │  │ video ──▶│    │  API (STT) ──▶│      │ │
│                      │  │ frames   │    │  transcript   │      │ │
│                      │  │ sent via │    │  sent to      │      │ │
│                      │  │ WS to    │    │  backend      │      │ │
│                      │  │ backend  │    │               │      │ │
│                      │  └────┬─────┘    └──────┬────────┘      │ │
│                      │       │                  │               │ │
│                      │       ▼                  ▼               │ │
│                      │  ┌──────────────────────────────────┐   │ │
│                      │  │      OUTPUT LAYER                 │   │ │
│                      │  │  (profile-driven rendering)       │   │ │
│                      │  │                                   │   │ │
│                      │  │  Deaf: captions + tone badges +   │   │ │
│                      │  │        quick-reply buttons +      │   │ │
│                      │  │        vibration patterns          │   │ │
│                      │  │                                   │   │ │
│                      │  │  Blind: TTS audio summaries +     │   │ │
│                      │  │         haptic cues                │   │ │
│                      │  └──────────────────────────────────┘   │ │
│                      └──────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI + Python)                     │
│                                                                   │
│  WebSocket Endpoints:                                             │
│                                                                   │
│  /ws/sign-detection                                               │
│     Receives video frames (base64)                                │
│     → MediaPipe Holistic (landmark extraction)                    │
│     → LSTM model (sign classification)                            │
│     → Returns: { sign: "hello", confidence: 0.95 }               │
│                                                                   │
│  /ws/conversation                                                 │
│     Receives audio chunks                                         │
│     → Groq Whisper API (fast STT)                                 │
│     → Hume AI Expression Measurement (tone/prosody)               │
│     → Claude/GPT API (jargon simplification + quick-reply gen)    │
│     → Returns: { transcript, tone, simplified, quick_replies }    │
│                                                                   │
│  REST Endpoints:                                                  │
│                                                                   │
│  POST /tts                                                        │
│     Receives text (quick-reply selection or sign detection)        │
│     → ElevenLabs API (streaming TTS)                              │
│     → Returns: audio stream                                       │
│                                                                   │
│  POST /profile                                                    │
│     Receives profile config from onboarding                       │
│     → Stores in-memory (no DB needed for demo)                    │
│                                                                   │
│  ML Pipeline (loaded at server start):                            │
│     MediaPipe Holistic model                                      │
│     LSTM sign classifier (action_model.h5)                        │
│     30-frame sliding window buffer per connection                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack (Final)

| Layer | Technology | Owner |
|-------|-----------|-------|
| Frontend framework | Next.js 14 (App Router) + Tailwind | Frontend team |
| PWA setup | next-pwa, deployed on Vercel with HTTPS | Frontend 1 |
| Video call | PeerJS 1.5.5 (free cloud signaling server) | Frontend 2 |
| State management | React Context for profile + Zustand for app state | Frontend team |
| Backend framework | FastAPI (Python, async) on Railway | Backend lead |
| WebSocket | FastAPI WebSocket endpoints | Backend lead |
| STT (speech-to-text) | Groq Whisper API (fastest option) | Backend lead |
| TTS (text-to-speech) | ElevenLabs streaming API | Backend lead |
| Tone/emotion analysis | Hume AI Expression Measurement API | Backend lead |
| Jargon simplification | Claude API (or GPT-4) | Backend lead |
| Quick-reply generation | Claude API (or GPT-4) | Backend lead |
| Landmark extraction | MediaPipe Holistic (Python, legacy API) | ML lead |
| Sign classification | Keras LSTM (3-layer, tanh) | ML lead |
| Sign data format | .npy keypoint sequences (30 frames × 1662 features) | ML lead |

### API Keys Needed (get these BEFORE the hackathon)
- [ ] Hume AI API key (free tier at dev.hume.ai)
- [ ] ElevenLabs API key (free tier)
- [ ] Groq API key (free tier, very fast Whisper)
- [ ] Anthropic or OpenAI API key (for Claude/GPT jargon simplification)
- [ ] Vercel account (free, for frontend deployment)
- [ ] Railway account (free tier, for backend deployment)

---

## 48-Hour Sprint — Per-Person Breakdown

### HOURS 0–2: Everyone — Setup & Alignment

All 5 people in the same room/call.

- Confirm everyone has dev environment working (Node.js, Python 3.10+, pip, npm)
- Clone the shared repo, set up monorepo structure:
  ```
  senseai/
  ├── frontend/          (Next.js)
  ├── backend/           (FastAPI)
  ├── ml/                (MediaPipe + LSTM training)
  ├── models/            (trained .h5 files)
  └── demo/              (video assets, scripts)
  ```
- Backend lead: verify all API keys work (Hume, ElevenLabs, Groq, Claude)
- ML lead: verify MediaPipe Holistic runs on their machine, test webcam capture
- Frontend team: scaffold Next.js app, install Tailwind, PeerJS, verify Vercel deploy
- **Everyone agrees on the WebSocket message format** (this prevents integration hell later):

```json
// Sign detection response
{ "type": "sign", "sign": "hello", "confidence": 0.95 }

// Conversation response
{
  "type": "conversation",
  "transcript": "Your blood sugar is a bit high",
  "speaker": "Doctor",
  "tone": { "careful": 0.7, "concerned": 0.6 },
  "simplified": "Your sugar levels are higher than normal",
  "quick_replies": ["How serious is it?", "What should I do?", "I understand"]
}

// TTS request
{ "type": "tts", "text": "Could you tell me how serious this is?" }
```

---

### ML LEAD — Full 48-Hour Track

**Goal: working sign language detection pipeline, 8-10 ASL signs, >90% accuracy**

| Hours | Task | Output |
|-------|------|--------|
| 0–2 | Setup with team (above) | Environment ready |
| 2–4 | Build data collection script. Webcam → MediaPipe Holistic → extract keypoints → save .npy. Base this on nicknochnack/ActionDetectionforSignLanguage | `collect_data.py` working |
| 4–8 | Record training data for 10 signs. 30 sequences × 30 frames each. Signs: Hello, Thank You, Sorry, Help, Please, Yes, No, I Love You, Goodbye, More | `ml/MP_Data/` folder populated |
| 8–10 | Build + train LSTM model. 3-layer LSTM, tanh activation, 200 epochs | `models/action_model.h5` saved, >90% accuracy |
| 10–12 | Test real-time inference standalone (webcam → MediaPipe → LSTM → print prediction). Debug false positives, tune confidence threshold | Working standalone demo |
| 12–16 | Build WebSocket integration: FastAPI `/ws/sign-detection` endpoint that receives base64 frames from browser, runs MediaPipe + LSTM, returns predictions. Coordinate with backend lead on the endpoint structure | WebSocket endpoint working |
| 16–20 | Integration testing with frontend. Frontend sends frames, receives predictions. Debug latency, frame dropping, buffer issues | End-to-end sign detection in browser |
| 20–24 | Add "no sign" / idle detection (model should not hallucinate signs when hands are resting). Add confidence smoothing (require N consecutive high-confidence predictions before outputting a sign) | Robust predictions, fewer false positives |
| 24–30 | If time: expand vocabulary to 15 signs. If not: polish existing 10 signs, improve accuracy with more training data | Final model |
| 30–36 | Help frontend team with sign detection UI bugs. Help record demo video segments | Support role |
| 36–42 | Final model freeze. Any last accuracy improvements | `action_model_final.h5` |
| 42–48 | Demo recording, bug fixes, buffer | Done |

**Critical path items for ML lead:**
- Data collection MUST be done by hour 8. No data = no model.
- The WebSocket frame pipeline (hour 12-16) is the hardest integration point. ML lead and backend lead should pair on this.
- Use `tanh` activation, NOT `relu` for LSTM layers.
- The confidence threshold matters more than accuracy — a false positive in a demo is worse than a missed sign.

---

### BACKEND LEAD — Full 48-Hour Track

**Goal: FastAPI server with WebSocket endpoints for sign detection, conversation intelligence, and TTS**

| Hours | Task | Output |
|-------|------|--------|
| 0–2 | Setup with team (above) | Environment ready |
| 2–5 | FastAPI skeleton: project structure, CORS, WebSocket boilerplate, health check endpoint. Deploy to Railway early (deploy-first development) | `backend/` running on Railway |
| 5–8 | `/ws/conversation` endpoint: receive audio → Groq Whisper STT → return transcript. Test with simple audio from browser | Live transcription working |
| 8–11 | Add Hume AI integration: send audio to Hume Expression Measurement API → receive prosody/tone scores → attach to transcript response. Map Hume's 48 dimensions to simplified labels ("speaking carefully", "sounds concerned", "neutral") | Tone-annotated transcripts |
| 11–14 | Add Claude/GPT integration: send transcript + context → receive jargon simplification + 3 quick-reply suggestions. Design the prompt carefully — it needs to simplify medical/legal jargon while preserving meaning | Simplified text + quick replies |
| 14–16 | `/api/tts` endpoint: receive text → ElevenLabs streaming API → return audio. Test with quick-reply text | TTS working |
| 16–20 | `/ws/sign-detection` endpoint: coordinate with ML lead. Receive base64 frames from browser → pass to MediaPipe + LSTM pipeline → return predictions. This is the hardest integration — ML lead should pair with you here | Sign detection WebSocket working |
| 20–24 | Add Hume facial expression analysis: for video call mode, periodically send frame snapshots to Hume face API → return facial emotion scores → send to frontend alongside sign predictions | Facial emotion working |
| 24–28 | Stress testing and optimization. Handle disconnections gracefully, add connection health checks, optimize frame throughput for sign detection | Stable backend |
| 28–32 | Add "blind profile" conversation mode: instead of returning captions + quick-replies, return an audio summary via TTS. Same Whisper + Claude pipeline but with different prompt ("summarize this concisely for someone listening via earbuds") | Blind mode conversation |
| 32–36 | Edge cases: what happens when Hume API is slow? Fallback to AFINN text sentiment. What if Groq is down? Fallback to Web Speech API on frontend | Graceful degradation |
| 36–42 | Bug fixes, support frontend integration, help with demo recording | Support role |
| 42–48 | Demo recording, final fixes, buffer | Done |

**Critical path items for backend lead:**
- Deploy to Railway in hour 2-5, not at the end. Frontend team needs a live URL to connect to.
- The Hume AI WebSocket integration is the most valuable "wow factor" for the demo — prioritize it.
- Design Claude/GPT prompts for quick-reply generation early. Bad prompts = useless quick-replies.
- The TTS endpoint should support streaming audio, not batch — ElevenLabs supports this natively.

---

### FRONTEND 1 — Onboarding + Profile System + App Shell

**Goal: the adaptive profile system that makes the whole app feel like it switches personalities**

| Hours | Task | Output |
|-------|------|--------|
| 0–2 | Setup with team (above) | Environment ready |
| 2–5 | App shell: Next.js layout, navigation between modes, responsive design. Set up Tailwind with a clean accessibility-first theme (high contrast, large touch targets) | Basic app skeleton |
| 5–9 | Onboarding flow (2 screens): Screen 1 — "How do you experience the world?" [I'm deaf / hard of hearing] [I'm blind / visually impaired]. Screen 2 — confirmation screen adapted to chosen profile. Store profile in React Context | Working onboarding |
| 9–13 | Profile-driven rendering system: create a `useProfile()` hook that components use to decide what to render. Build wrapper components: `<ForDeaf>`, `<ForBlind>`, `<ForBoth>` that conditionally render children based on profile | Profile system working |
| 13–17 | Home screen with mode selection. Deaf profile sees: [Start Video Call] [Start Conversation Mode] [Settings]. Blind profile sees: large simple buttons, screen reader labels, or auto-reads options via TTS | Home screen for both profiles |
| 17–21 | Haptic feedback system: define vibration patterns using Navigator.vibrate(). 2 short = location/status update, 1 long = attention needed, 3 quick = someone is speaking. Wire these into conversation and sign detection events | Haptic patterns working |
| 21–26 | Settings page: ability to switch profiles, adjust text size, toggle haptic feedback. Simple but functional | Settings page |
| 26–30 | Accessibility audit: screen reader labels (aria-label on everything), keyboard navigation, focus management, color contrast check | Accessible app |
| 30–36 | Polish: transitions between screens, loading states, error states, empty states. Make it feel like a real app, not a hackathon prototype | Polished UI |
| 36–42 | Help record demo video. Do the onboarding recording and profile-switching demo | Demo segments recorded |
| 42–48 | Final polish, bug fixes, buffer | Done |

---

### FRONTEND 2 — Video Call Mode (Sign Language)

**Goal: PeerJS video call with sign detection overlay, emotion badges, and TTS output**

| Hours | Task | Output |
|-------|------|--------|
| 0–2 | Setup with team (above) | Environment ready |
| 2–6 | Basic PeerJS video call: two users connect with a room code, see each other's video, hear each other's audio. Use PeerJS free cloud server. Test in two browser tabs | Video call working |
| 6–10 | Add data channel: detected signs and emotions are sent between peers as JSON messages. Display received messages as text overlay on the remote video | Data channel working |
| 10–14 | Frame capture pipeline: capture frames from local video element at ~10 FPS, convert to base64, send to backend via WebSocket `/ws/sign-detection`. Display returned sign predictions as text overlay | Sign detection connected to video call |
| 14–18 | Sign detection UX: show detected sign as a large caption below the video ("HELLO" with confidence bar). Add animation when a new sign is detected. Buffer repeated detections (don't show "hello hello hello") | Clean sign detection display |
| 18–22 | TTS integration: when a sign is detected, send text to `/api/tts` endpoint, play returned audio through the remote peer's speakers. The hearing person hears the sign spoken aloud | Sign → TTS working |
| 22–26 | Emotion badges on video: receive Hume facial emotion data from backend, display as small badges on the video feed (😊 happy, 😟 concerned, etc.) | Emotion overlay working |
| 26–30 | Deaf-profile-specific UI: when profile is deaf, the remote user's audio is also transcribed via Web Speech API and displayed as captions. Two-way communication: deaf user signs → hearing user hears TTS. Hearing user speaks → deaf user reads captions | Full bidirectional communication |
| 30–36 | Polish: call controls (mute, end call, toggle sign detection), connection status indicator, reconnection handling | Production-feel video call |
| 36–42 | Help record demo video — record the video call demo with another team member | Demo segments recorded |
| 42–48 | Final polish, bug fixes, buffer | Done |

---

### FRONTEND 3 — Conversation Intelligence Mode (In-Person)

**Goal: live captions with tone, quick-replies, and profile-adapted output**

| Hours | Task | Output |
|-------|------|--------|
| 0–2 | Setup with team (above) | Environment ready |
| 2–6 | "Listen mode" UI: a prominent button to start/stop listening. When active, capture audio via browser MediaRecorder API, stream chunks to backend `/ws/conversation` via WebSocket | Audio streaming to backend |
| 6–10 | Caption display: receive transcript + tone from backend, render as scrolling captions. Style like the SenseAI brief described: "[Dr. Lee, speaking carefully]: Your blood sugar is a bit high." Speaker labels are editable (user taps to rename "Speaker 1" → "Dr. Lee") | Live captions with tone |
| 10–14 | Quick-reply system: receive quick-reply suggestions from backend, display as tappable buttons below captions. Also show persistent universal replies: [One moment please] [Can you repeat that?]. Add text input for custom responses | Quick-reply buttons working |
| 14–18 | TTS for quick-replies: when user taps a quick-reply, send to backend for Claude rephrasing → ElevenLabs TTS → play audio through phone speaker. The doctor/conversant hears a natural-sounding response | Quick-reply → TTS working |
| 18–22 | Blind profile adaptation: same conversation backend, but instead of captions, play audio summaries through earbuds. After each speaker turn, TTS whispers a summary: "Your doctor sounds concerned. They said your blood sugar is high." User responds by speaking naturally (their speech goes through the phone mic/speaker, no TTS needed) | Blind mode conversation working |
| 22–26 | Tone badges: map Hume emotion scores to visual indicators. Show small colored badges next to speaker names (green = calm, yellow = concerned, red = upset). For blind users, incorporate tone into the audio summary ("your doctor sounds worried") | Tone visualization |
| 26–30 | Conversation intro feature: at the start of Listen mode, option to play an introduction through the speaker: "Hello, I'm an accessibility assistant helping [user] communicate today" | Conversation intro |
| 30–36 | Polish: smooth scrolling captions, animation on new quick-replies, vibration when new speech detected, clean empty/waiting states | Polished conversation UI |
| 36–42 | Help record demo video — record the in-person conversation demo (one team member plays "doctor") | Demo segments recorded |
| 42–48 | Final polish, bug fixes, buffer | Done |

---

## Integration Checkpoints (CRITICAL — don't skip these)

These are moments where multiple people's work needs to connect. Schedule these explicitly.

| Hour | Who | What | If It Fails |
|------|-----|------|-------------|
| 8 | Backend + Frontend 2 + Frontend 3 | Backend is deployed on Railway. Both frontends can connect via WebSocket | Everything is blocked. Backend lead prioritizes this above all else |
| 14 | ML lead + Backend lead | Sign detection WebSocket endpoint works end-to-end (frame in → prediction out) | ML lead tests standalone, backend uses mock predictions for frontend |
| 16 | Frontend 2 + Backend | Video call sends frames to backend, receives sign predictions | Use hardcoded mock predictions if backend isn't ready |
| 18 | Frontend 3 + Backend | Conversation mode sends audio, receives captions + tone + quick-replies | Use Web Speech API as STT fallback, skip tone if Hume isn't ready |
| 24 | ALL | Full integration test. Both modes working end-to-end with real data | This is the "is this demo-able?" checkpoint. Decide what to cut |
| 36 | ALL | Feature freeze. No new features. Only bug fixes and demo recording | Strict. No exceptions. |

---

## Demo Video Structure (5 Minutes)

Since this is a pre-recorded submission, you can carefully script and edit this.

### Script

**[0:00–0:15] Hook**
"1 billion people live with disability. Most assistive tech forces them into one mode — audio only, or text only. SenseAI adapts to you."

**[0:15–0:35] Onboarding — Deaf User**
Screen recording: open app, select "I'm deaf / hard of hearing", confirmation with haptic feedback. Show the UI adapting — audio off, captions on, large visual elements.

**[0:35–1:45] Mode 1 Demo — Sign Language Video Call (Deaf User)**
Two team members on a video call. Deaf user signs "Hello" → app detects it → text appears on screen → hearing user hears "Hello" spoken aloud. Hearing user says "Hi, how are you?" → deaf user sees captions with tone badge. Deaf user signs "Thank you." Show the emotion badges updating. This is your WOW moment.

**[1:45–3:00] Mode 2 Demo — Doctor's Appointment (Deaf User)**
Team member plays doctor. Deaf user activates "Listen mode." Doctor speaks medical jargon → captions appear with tone annotations and simplified text. Quick-reply buttons appear. Deaf user taps "How serious is it?" → app speaks it aloud naturally. Doctor responds. Show the conversational flow.

**[3:00–3:15] Transition**
"Same AI. Same app. Different ability."

**[3:15–3:30] Onboarding — Blind User**
Screen recording (brief): select "I'm blind / visually impaired." App confirms via voice. Phone goes in pocket.

**[3:30–4:15] Mode 2 Demo — Doctor's Appointment (Blind User)**
Same doctor scenario. But now the user hears audio summaries through earbuds: "Your doctor sounds concerned. They said your blood sugar is high and wants to change your medication. Want to ask anything?" User speaks naturally. Show the contrast with the deaf user's visual experience.

**[4:15–4:40] Side-by-side comparison**
Split screen: deaf user's visual experience vs. blind user's audio experience. Same conversation, completely different delivery.

**[4:40–5:00] Closing**
"SenseAI doesn't ask you to adapt to technology. It adapts to you." Show the sign language detection, the captions with tone, the quick-replies, the profile switching — rapid montage of features.

### Recording Tips
- Record each segment 2-3 times, pick the best take
- Use a quiet room for the doctor conversation demo
- For the video call demo, use two laptops side-by-side showing both perspectives
- Screen record with OBS or built-in screen recording
- Edit with CapCut or DaVinci Resolve (both free)
- Add captions to YOUR demo video (it's an accessibility hackathon!)

---

## Fallback Plan (If Things Go Wrong)

| What breaks | Fallback |
|-------------|----------|
| LSTM accuracy is bad (<80%) | Reduce to 5 highly distinct signs. In the video demo, only show signs that work reliably |
| Hume AI is slow/down | Use AFINN text sentiment on STT transcript. Show "positive/negative/neutral" instead of 48 dimensions |
| ElevenLabs is slow/down | Use browser Web Speech API SpeechSynthesis (free, built-in, less natural sounding) |
| Groq Whisper is slow/down | Use browser Web Speech API SpeechRecognition (free, Chrome only) |
| PeerJS cloud server is down | Run local PeerServer: `npx peerjs --port 9000` |
| WebSocket frame pipeline is too slow | Reduce to 5 FPS. Or pre-record a sign detection demo and splice it into the video |
| Claude/GPT is slow for quick-replies | Pre-define 10 common quick-replies per context (medical, casual). Use rule-based matching instead of LLM |
| Railway deploy fails | Run backend on localhost for demo recording. Both machines on same WiFi |
| Frontend team is blocked by backend | Every frontend component should work with MOCK DATA first. Build with fake responses, connect real backend later |

---

## Pre-Hackathon Checklist (Do This NOW)

- [ ] All 5 team members have Node.js 18+, Python 3.10+, pip, npm installed
- [ ] Shared GitHub repo created with monorepo structure
- [ ] All API keys obtained and tested:
  - [ ] Hume AI (dev.hume.ai — sign up, get API key, test the playground)
  - [ ] ElevenLabs (elevenlabs.io — sign up, get API key, test TTS)
  - [ ] Groq (console.groq.com — sign up, get API key, test Whisper)
  - [ ] Anthropic or OpenAI (for Claude/GPT)
- [ ] ML lead has tested MediaPipe Holistic on their machine with webcam
- [ ] Frontend team has scaffolded Next.js app and deployed to Vercel
- [ ] Backend lead has scaffolded FastAPI app and deployed to Railway
- [ ] Everyone has read this sprint plan and knows their hour-by-hour tasks
- [ ] Someone has downloaded OBS for screen recording
- [ ] Team has agreed on a Slack/Discord channel for async communication during the hackathon
