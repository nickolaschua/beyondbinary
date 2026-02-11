# Simple Video Room - Single Global Room

## What Changed

✅ **One global room for everyone** - No more session IDs needed!
✅ **Works across different profiles** - Blind can connect with Deaf, etc.
✅ **Maximum 2 people** - Simple 1-on-1 video calls
✅ **Just open and connect** - Automatically joins the same room

## How It Works Now

Everyone joins a single room called `"global-video-room"` regardless of:
- Which profile they choose (blind, deaf, mute, deafblind)
- What URL they use
- When they join

## Testing Instructions

### Test 1: Same Profile (e.g., both Deaf)

**Browser 1:**
1. Go to http://localhost:3000/live/deaf
2. Click "Turn camera on"

**Browser 2:**
1. Go to http://localhost:3000/live/deaf (any URL works)
2. Click "Turn camera on"

**Result:**
- ✅ Both see each other
- ✅ "Connected" badge appears
- ✅ Chat works

### Test 2: Different Profiles (e.g., Blind + Deaf)

**Browser 1:**
1. Go to http://localhost:3000/live/blind
2. Click "Turn camera on"

**Browser 2:**
1. Go to http://localhost:3000/live/deaf
2. Click "Turn camera on"

**Result:**
- ✅ Both see each other
- ✅ Different UI features (blind has audio, deaf has captions)
- ✅ Video and chat work across profiles

### Test 3: Any URL Works

**Browser 1:**
1. Go to http://localhost:3000/live/deafblind?api=http://localhost:8000&ws=ws://localhost:8000&source=local&sid=12345

**Browser 2:**
1. Go to http://localhost:3000/live/mute?api=http://localhost:8000&ws=ws://localhost:8000&source=local&sid=99999

**Result:**
- ✅ Still connect! Session ID doesn't matter
- ✅ All join the same global room

## Console Logs to Verify

When you connect, you'll see:

```
[LiveWorkspace] Joining global video room
[WebRTC] Peer joined, ensuring peer connection exists
[WebRTC] Creating new peer connection
[WebRTC] Connection state changed: connecting
[WebRTC] Connection state changed: connected
```

## Architecture

```
┌─────────────────────────────────────┐
│  Browser 1 (any profile)            │
│  → Joins "global-video-room"        │
│  → WebSocket connects to backend    │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  Backend WebSocket Server           │
│  Room: "global-video-room"          │
│  Peers: [User1, User2]              │
│  Max: 2 people                      │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  Browser 2 (any profile)            │
│  → Joins "global-video-room"        │
│  → Connects to User1                │
└─────────────────────────────────────┘
```

## Benefits

1. **Simple**: No room management, just open and go
2. **Cross-profile**: Blind users can video chat with deaf users
3. **No URL dependencies**: Any URL works, all join same room
4. **Easy testing**: Open two browsers, both connect automatically

## Limitations

- **Max 2 people**: This is 1-on-1 only (not group video)
- **Global room**: Everyone joins the same room (no privacy/separation)
- **No room selection**: Can't choose different rooms

## Future Enhancements

If you want to expand this:

1. **Multiple rooms**: Add room selector UI
2. **Room codes**: Share 4-digit codes to join specific rooms
3. **Group calls**: Support 3+ people in a room
4. **Persistent rooms**: Save room preferences per user

## Troubleshooting

**"Why aren't we connecting?"**

Check:
1. Backend is running (http://localhost:8000)
2. Both browsers are accessing via localhost or same ngrok URL
3. Console shows `[LiveWorkspace] Joining global video room`
4. WebSocket shows connected

**"I see someone else in my call!"**

This is expected - there's only ONE global room. Everyone using the app joins the same room. If you need separate rooms, you'll need to implement room selection.

## Quick Demo

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
./run_dev.sh

# Terminal 2: Frontend
cd senseai-frontend
npm run dev

# Browser 1: http://localhost:3000/live/blind
# Browser 2: http://localhost:3000/live/deaf
# Both turn on camera → Connected!
```

That's it! Simple, no-fuss video calling. 🎉
