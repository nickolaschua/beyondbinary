# Quick Fix: Camera/Microphone Access Issues

## The Problem

You're seeing these errors:
- ❌ "Microphone access denied"
- ❌ "Camera error: Cannot read properties of undefined (reading 'getUserMedia')"

## Why This Happens

**Browsers only allow camera/microphone access on:**
- ✅ `http://localhost:3000` or `http://127.0.0.1:3000`
- ✅ `https://` (secure HTTPS connections)
- ❌ NOT on `http://10.91.174.93:3000` (network IP over HTTP)

This is a browser security feature, not a bug in the code!

## The Solution

### Option 1: Use Localhost (Quick Test)

Just access via localhost instead:
```
http://localhost:3000
```

**Limitations:** Can't test video calls between different devices.

### Option 2: Use Ngrok (For Cross-Device Video Calls)

This creates an HTTPS tunnel that works everywhere:

**Terminal 1 - Start backend:**
```bash
cd backend
source venv/bin/activate
./run_dev.sh
```

**Terminal 2 - Start frontend:**
```bash
cd senseai-frontend
npm run dev
```

**Terminal 3 - Start ngrok tunnel:**
```bash
cd senseai-frontend
npm run tunnel
```

**Result:** You'll see output like:
```
Forwarding https://abc123.ngrok-free.app -> http://localhost:3000
```

**Use that HTTPS URL on ALL devices!**

### For Backend Access via Ngrok (if needed)

If devices can't reach your backend at http://10.91.174.93:8000, tunnel it too:

**Terminal 4:**
```bash
ngrok http 8000
```

Then set environment variables when starting frontend:
```bash
NEXT_PUBLIC_API_URL=https://your-backend-ngrok-url \
NEXT_PUBLIC_WS_URL=wss://your-backend-ngrok-host \
npm run dev
```

## What Works Now

✅ Camera access (with localhost or HTTPS)
✅ Microphone access (with localhost or HTTPS)
✅ Video calls between different browsers/devices
✅ Chat functionality
✅ Sign language detection
✅ All accessibility features

## Quick Reference

| URL Type | Camera/Mic | Video Calls | Use Case |
|----------|------------|-------------|----------|
| http://localhost:3000 | ✅ | ❌ | Single device testing |
| http://10.91.174.93:3000 | ❌ | ❌ | Won't work for media |
| https://xxx.ngrok-free.app | ✅ | ✅ | Best for demos |

## Need Help?

See `NETWORK_SETUP.md` for detailed troubleshooting and explanation.
