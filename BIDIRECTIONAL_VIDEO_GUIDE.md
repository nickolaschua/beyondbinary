# Bidirectional Video Room - Implementation Guide

## What Was Fixed

The video room now works **bidirectionally** - both users can see each other regardless of who joined first!

### Previous Behavior ❌
- Only the second person who joined could see the first person
- The first person couldn't see the second person
- Video was one-way only

### New Behavior ✅
- Both users see each other
- Works regardless of join order
- Handles camera toggle during calls
- Automatic renegotiation when tracks change

## Technical Changes Made

### 1. Refactored `useWebRTC` Hook (`src/hooks/useWebRTC.ts`)

**Key Changes:**
- **Single peer connection**: Creates PC once using `ensurePeerConnection()` instead of recreating for every offer/answer
- **Dynamic track management**: New `updateTracks()` function adds/removes tracks without recreating PC
- **Automatic renegotiation**: `onnegotiationneeded` event handler triggers new offers when tracks change
- **Track state tracking**: Maintains `currentTracksRef` to know which tracks are already added

**Before:**
```typescript
const createPeerConnection = () => {
  const pc = new RTCPeerConnection(...);
  // ❌ Only adds tracks that exist right now
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }
  return pc;
};

// ❌ Creates NEW PC every time
const createOffer = () => {
  const pc = createPeerConnection(); // New PC with current tracks
  ...
};

const handleOffer = () => {
  const pc = createPeerConnection(); // Another new PC!
  ...
};
```

**After:**
```typescript
const ensurePeerConnection = () => {
  if (peerConnectionRef.current) return peerConnectionRef.current;
  // ✅ Creates PC once without tracks
  const pc = new RTCPeerConnection(...);
  peerConnectionRef.current = pc;
  return pc;
};

const updateTracks = (stream) => {
  // ✅ Dynamically adds/removes tracks on existing PC
  const pc = peerConnectionRef.current;
  // Remove old tracks, add new tracks
  ...
};

// ✅ Watch for stream changes and update tracks
useEffect(() => {
  if (peerConnectionRef.current) {
    updateTracks(localStream);
  }
}, [localStream]);
```

### 2. Updated `LiveWorkspace` Component (`src/components/LiveWorkspace.tsx`)

**Key Changes:**
- **Eager PC creation**: Creates peer connection immediately when peer joins (doesn't wait for camera)
- **Removed stream dependency**: Offer creation no longer requires `localStreamState` to be ready
- **Renegotiation callback**: Handles `onNeedRenegotiation` to send new offers when tracks change

**Before:**
```typescript
// ❌ Only creates offer if camera is already on
useEffect(() => {
  if (shouldCreateOffer && remotePeerId && localStreamState) {
    createOffer().then(offer => sendOffer(offer));
  }
}, [shouldCreateOffer, remotePeerId, localStreamState]);
```

**After:**
```typescript
// ✅ Creates PC as soon as peer joins
useEffect(() => {
  if (remotePeerId) {
    ensurePeerConnection(); // Create PC immediately
  }
}, [remotePeerId]);

// ✅ Creates offer even without camera (tracks added later)
useEffect(() => {
  if (shouldCreateOffer && remotePeerId) {
    createOffer().then(offer => sendOffer(offer));
  }
}, [shouldCreateOffer, remotePeerId]); // No localStreamState dependency!

// ✅ Handles renegotiation when camera toggles
const webrtcHook = useWebRTC({
  onNeedRenegotiation: () => {
    if (connectionState === "connected") {
      createOffer().then(offer => sendOffer(offer)); // New offer
    }
  }
});
```

## How It Works Now

### Scenario 1: Both Join Without Camera, Then Turn On

**Timeline:**
1. User A joins room → PC created (no tracks yet)
2. User B joins room → PC created (no tracks yet)
3. User A designated as offerer → creates offer (empty tracks)
4. User B receives offer → creates answer (empty tracks)
5. **Connection established** (connected but no video yet)
6. User A clicks "Turn camera on" → `updateTracks()` adds video/audio tracks → triggers renegotiation
7. User A's PC fires `onnegotiationneeded` → new offer created and sent
8. User B receives new offer → answers with their current tracks (still none)
9. **User A's video appears on User B's screen** ✅
10. User B clicks "Turn camera on" → `updateTracks()` adds tracks → renegotiation
11. User B's new offer sent → User A answers
12. **User B's video appears on User A's screen** ✅
13. **Both see each other!** 🎉

### Scenario 2: User A Has Camera, User B Joins Later

**Timeline:**
1. User A joins with camera on → PC created with tracks
2. User B joins without camera → PC created without tracks
3. User A creates offer (with video/audio) → User B answers (no tracks)
4. **User A sees nothing** (User B has no tracks) ❌
5. **User B sees User A** (User A has tracks) ✅
6. User B turns camera on → triggers renegotiation → new offer
7. User B's offer sent (with tracks) → User A answers
8. **User A now sees User B** ✅
9. **Both see each other!** 🎉

### Scenario 3: Both Join With Cameras On

**Timeline:**
1. User A joins with camera → PC created, tracks added
2. User B joins with camera → PC created, tracks added
3. User A creates offer (with tracks) → User B answers (with tracks)
4. **Both immediately see each other!** 🎉

## Testing Instructions

### Test 1: Basic Bidirectional Video

**Setup:**
- Two browser windows or devices
- Access via `http://localhost:3000` (or same ngrok URL)

**Steps:**
1. **Window 1**: Navigate to deafblind workspace, note session ID
2. **Window 2**: Navigate to same session ID URL
3. **Window 1**: Click "Turn camera on"
4. **Window 2**: Click "Turn camera on"

**Expected Result:**
- ✅ Window 1 sees Window 2's video (in small PiP window)
- ✅ Window 2 sees Window 1's video (in small PiP window)
- ✅ Both show "Connected" badge

### Test 2: Join Order Doesn't Matter

**Steps:**
1. **Window 1**: Join session, DON'T turn camera on
2. **Window 2**: Join same session, turn camera on immediately
3. **Window 1**: Now turn camera on

**Expected Result:**
- ✅ Window 2 sees Window 1 after step 3
- ✅ Window 1 sees Window 2 after step 2
- ✅ Bidirectional video established

### Test 3: Camera Toggle During Call

**Steps:**
1. Establish bidirectional video (both cameras on)
2. **Window 1**: Click "Turn camera off"
3. Wait 2-3 seconds
4. **Window 1**: Click "Turn camera on" again

**Expected Result:**
- ✅ Window 2's video goes away when Window 1 turns off camera
- ✅ Window 2's video reappears when Window 1 turns camera back on
- ✅ No need to refresh or rejoin

### Test 4: Join Without Camera, Add Later

**Steps:**
1. **Both windows**: Join session without turning on camera
2. Verify "Connected" badge eventually appears
3. **Window 1**: Turn camera on
4. **Window 2**: Turn camera on

**Expected Result:**
- ✅ Connection established even without video
- ✅ Video appears as soon as cameras are turned on
- ✅ Both see each other

## Debugging

### Check Browser Console

Open console (F12) and look for these logs:

**Good Flow:**
```
[WebRTC] Peer joined, ensuring peer connection exists
[WebRTC] Creating new peer connection
[WebRTC] Creating offer for peer: abc123
[WebRTC] Created and set offer
[WebRTC] Adding track: video xyz789
[WebRTC] Adding track: audio abc456
[WebRTC] Connection state changed: connecting
[WebRTC] Connection state changed: connected
[WebRTC] Received remote track: video readyState: live
[WebRTC] Received remote track: audio readyState: live
```

**Problem Indicators:**
```
[WebRTC] No peer connection yet, can't update tracks
[WebRTC] Failed to create offer: Error...
[WebRTC] Already negotiating, skipping
```

### Common Issues

**Issue: "Already negotiating, skipping"**
- **Cause**: Multiple renegotiations triggered simultaneously
- **Solution**: Should resolve automatically, wait a few seconds

**Issue: Video appears then disappears**
- **Cause**: Track ended or remote peer turned off camera
- **Solution**: Check other peer's camera status

**Issue: No video ever appears**
- **Cause**: Peer connection failed or not established
- **Solution**: Check console for connection state errors, verify both are in same session

## Architecture Summary

```
┌─────────────────────────────────────────────┐
│           User A (First Joiner)             │
├─────────────────────────────────────────────┤
│ 1. Joins room                               │
│ 2. Creates PeerConnection (empty)           │
│ 3. Receives peer_joined (create_offer=true) │
│ 4. Creates offer (even without camera)      │
│ 5. Sends offer to backend                   │
│ 6. Receives answer from User B              │
│ 7. Connection established                   │
│                                             │
│ Later: Turns camera on                      │
│ 8. updateTracks() adds video/audio          │
│ 9. onnegotiationneeded fires                │
│ 10. Creates new offer                       │
│ 11. User B sees User A's video ✅           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│           User B (Second Joiner)            │
├─────────────────────────────────────────────┤
│ 1. Joins room                               │
│ 2. Creates PeerConnection (empty)           │
│ 3. Receives peer_joined (create_offer=false)│
│ 4. Receives offer from User A               │
│ 5. handleOffer() processes it               │
│ 6. Creates answer (even without camera)     │
│ 7. Sends answer to backend                  │
│ 8. Connection established                   │
│                                             │
│ Later: Turns camera on                      │
│ 9. updateTracks() adds video/audio          │
│ 10. onnegotiationneeded fires               │
│ 11. Creates new offer                       │
│ 12. User A sees User B's video ✅           │
└─────────────────────────────────────────────┘

Backend WebSocket: Relays offers, answers, and ICE candidates
```

## Key Takeaways

1. **Peer connection is created once** per peer, not per offer/answer
2. **Tracks are managed dynamically** - can be added/removed after PC creation
3. **Renegotiation is automatic** - when tracks change, new offers are sent
4. **No dependency on camera state** - connection works even without video
5. **True bidirectional** - both users see each other, always

## Next Steps

If you want to enhance this further:

1. **Add connection state UI** - Show "Connecting...", "Waiting for video...", "Connected"
2. **Handle multiple peers** - Currently supports 1:1, could extend to group calls
3. **Add TURN server** - For better NAT traversal in production
4. **Persist stream state** - Remember camera on/off preference
5. **Add audio mute toggle** - Independent audio control
