# Network Setup Guide - Cross-Browser Video Calls

This guide explains how to set up your application for cross-browser video calls and chat functionality on the same network.

## Quick Setup (Same Network)

### 1. Start Backend (Terminal 1)

```bash
cd backend
source venv/bin/activate
./run_dev.sh
```

This will start the backend on `0.0.0.0:8000`, making it accessible from any device on your network.

**Backend URLs:**
- Local: http://localhost:8000
- Network: http://10.91.174.93:8000

### 2. Start Frontend (Terminal 2)

```bash
cd senseai-frontend
npm run dev
```

This will start the frontend on `0.0.0.0:3000`, accessible from your network.

**Frontend URLs:**
- Local: http://localhost:3000
- Network: http://10.91.174.93:3000

### 3. Access from Different Browsers/Devices

Now you can access the app from:

1. **Same computer, different browser:**
   - Browser 1: http://localhost:3000
   - Browser 2: http://localhost:3000

2. **Different devices on same WiFi:**
   - Device 1: http://10.91.174.93:3000
   - Device 2: http://10.91.174.93:3000

## How It Works

### WebRTC Signaling Flow

1. Both browsers connect to the WebSocket at `/ws/conversation`
2. When you join a session (via the session ID), the backend:
   - Registers both peers in the same "room"
   - Notifies existing peers when a new peer joins
3. WebRTC offer/answer exchange happens via the backend WebSocket:
   - First peer creates an offer
   - Second peer receives the offer and creates an answer
   - ICE candidates are exchanged for NAT traversal
4. Once connected, video/audio streams directly between browsers (peer-to-peer)

### Chat Functionality

The chat system is already implemented and works via the same WebSocket:

1. Type a message in the chat input box
2. Click "Send" or press Enter
3. The message is sent to the backend via WebSocket
4. Backend fans out the message to all other peers in the same room
5. Remote peers receive the message and display it

**Chat Features:**
- Real-time text messaging
- Sender identification (You vs Remote)
- Optional text-to-speech for blind users
- Persists in conversation history

## Troubleshooting

### Media Access Errors (Camera/Microphone)

**Error:** "MediaDevices API not available" or "Camera error: Cannot read properties of undefined"

**Cause:** You're accessing the site via a network IP (like http://10.91.174.93:3000) which browsers don't allow for camera/microphone access.

**Solution:**
1. **For single device testing:** Use http://localhost:3000
2. **For cross-device video calls:** Use ngrok:
   ```bash
   # Start frontend
   npm run dev

   # In another terminal, start tunnel
   npm run tunnel

   # Use the https://xxx.ngrok-free.app URL on all devices
   ```

### Backend Not Accessible from Network

**Problem:** Other devices can't connect to the backend.

**Solution:**
1. Make sure you're using `./run_dev.sh` or `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
2. Check your firewall settings - port 8000 should be open
3. Verify both devices are on the same WiFi network

### Frontend Not Accessible from Network

**Problem:** Other devices can't access the frontend.

**Solution:**
1. The custom server.js already binds to `0.0.0.0`
2. Check firewall settings - port 3000 should be open
3. Use the network IP (10.91.174.93:3000) instead of localhost

### Video Call Not Connecting

**Problem:** Video call shows but no remote stream appears.

**Possible causes:**
1. **WebSocket not connected:** Check browser console for WebSocket errors
2. **Room mismatch:** Make sure both peers are in the same session ID
3. **ICE candidate failures:** Check console for ICE gathering errors
4. **STUN server issues:** The app uses Google's public STUN servers

**Debug steps:**
1. Open browser console (F12) on both devices
2. Look for WebRTC-related logs (search for "[WebRTC]")
3. Check WebSocket connection status
4. Verify both devices joined the same room

### Chat Not Working

**Problem:** Messages don't appear on the other device.

**Solution:**
1. Verify WebSocket is connected (check status in UI)
2. Make sure both devices are in the same session/room
3. Check browser console for errors
4. Try sending from both directions

## Technical Details

### Network Configuration

- **Backend Host:** `0.0.0.0` (all interfaces)
- **Frontend Host:** `0.0.0.0` (all interfaces)
- **CORS:** Configured to allow localhost + 10.91.174.93
- **WebSocket Protocol:** `ws://` for local, upgrades automatically

### STUN/TURN Servers

Currently using Google's public STUN servers:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

**Note:** For production or complex NAT scenarios, you may need a TURN server.

### Ports Used

- Frontend: 3000
- Backend: 8000
- WebRTC: Negotiated dynamically via ICE

## Known Limitations

### Critical: Camera/Microphone Access Requires Localhost or HTTPS

**Important:** Modern browsers only allow camera and microphone access when the page is served via:
- `http://localhost` or `http://127.0.0.1`
- `https://` (secure connection)

**This means:**
- ✅ Works: http://localhost:3000
- ❌ Doesn't work: http://10.91.174.93:3000 (network IP over HTTP)

**Solution for cross-device testing:**

1. **Option A: Use localhost on each device separately** (no video call between devices)
   - Each device accesses http://localhost:3000
   - Works for testing individual features
   - Can't test video calls between devices

2. **Option B: Use ngrok for HTTPS tunneling** (recommended for video calls)
   ```bash
   # Terminal 1: Start frontend
   npm run dev

   # Terminal 2: Start ngrok tunnel
   npm run tunnel

   # Copy the https:// URL and use it on all devices
   ```

3. **Option C: Set up local HTTPS with self-signed certificates**
   - More complex setup
   - Requires certificate trust on all devices

### Other Limitations

1. **No TURN server:** Won't work across complex NATs or firewalls
2. **Room management:** Currently uses simple session IDs, no authentication

## Next Steps

For production deployment or remote access:
1. Use ngrok for tunneling (see senseai-frontend/README.md)
2. Set up a TURN server for NAT traversal
3. Enable HTTPS with proper certificates
4. Implement authentication for rooms
