# Video Call POC

Minimal 1-to-1 WebRTC video calling proof of concept.

## Features

- Browser-to-browser peer-to-peer video/audio
- Socket.IO signaling only (no media through server)
- STUN-only (Google STUN servers)
- Max 2 users per room (enforced)
- AI placeholders (audio tap, captions, tone detection)

## Quick Start

```bash
# Install dependencies
npm install

# Start the video-call server
npm start

# For real captions + tone: start the Beyond Binary backend (same repo)
cd ../backend && python -m uvicorn app.main:app --reload --port 8000

# Open in browser
# User 1: http://localhost:3001/?room=test
# User 2: http://localhost:3001/?room=test
```

**Real STT + tone:** If the Beyond Binary backend is running at `http://localhost:8000`, the app sends your microphone audio to it and shows live transcript and tone. If the backend is not running, the app falls back to placeholder captions/tone.

## Architecture

```
video-call-poc/
├── server/          # Node.js + Socket.IO signaling
│   ├── index.js     # Server bootstrap
│   ├── socket.js    # Signaling handlers
│   ├── rooms.js     # Room state (max 2 users)
│   └── config.js    # STUN config
│
├── client/          # Browser WebRTC + UI
│   ├── main.js      # Orchestration
│   ├── media.js     # getUserMedia
│   ├── peer.js      # RTCPeerConnection
│   ├── signaling.js # Socket.IO client
│   │
│   ├── ai/          # AI placeholders
│   │   ├── audioTap.js
│   │   ├── captions.js
│   │   └── tone.js
│   │
│   └── ui/          # UI helpers
│       ├── video.js
│       ├── controls.js
│       └── captions.js
│
└── shared/
    └── constants.js # Shared constants
```

## Constraints

- Exactly 2 users per room
- P2P only (no SFU/MCU)
- STUN only (no TURN)
- Browser-native WebRTC
- No third-party video SDKs

## AI Integration (Placeholder)

The `client/ai/` folder contains placeholder hooks for:

- **audioTap.js**: Fork audio stream for processing
- **captions.js**: Live subtitle generation (stub)
- **tone.js**: Tone/emotion detection (stub)

These are NOT implemented - just clean interfaces for future integration.

## Controls

- **Audio ON/OFF**: Mute/unmute microphone
- **Video ON/OFF**: Disable/enable camera
- **Captions**: Displays placeholder captions
- **Tone**: Shows placeholder tone indicator

## Room Management

- Each room supports exactly 2 users
- 3rd user gets "room full" error
- Peer leaves → remaining user notified
- Empty rooms auto-cleaned up

## Notes

- Requires HTTPS in production (WebRTC requirement)
- Works on localhost without HTTPS for testing
- Chrome/Edge/Firefox supported
- Safari may require additional polyfills
