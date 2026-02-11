# Video Call Debugging Guide

## Issue Fixed: Remote Video Not Showing Consistently

### What Was Wrong

1. **Conditional Rendering**: The remote video element was being unmounted and remounted when the stream changed, causing it to disappear
2. **Timing Issues**: Sometimes tracks arrived after the video element was attached to the stream
3. **No Track Event Handlers**: The code wasn't listening for new tracks being added to existing streams

### What Was Fixed

1. ✅ **Always render video elements** - They're now hidden with CSS instead of being unmounted
2. ✅ **Added track event listeners** - Detects when new tracks are added to the stream
3. ✅ **Better logging** - Console shows detailed info about stream and track states
4. ✅ **Force play** - Ensures video plays even if autoplay is delayed

## How to Debug Video Issues

### Open Browser Console (F12)

Look for these log messages:

**Good Signs (Working):**
```
[WebRTC] Received remote track: video readyState: live
[WebRTC] Remote stream received: {stream-id} tracks: 2
[WebRTC] Stream tracks: video:live, audio:live
[VideoCall] Attaching remote stream, tracks: 2
[VideoCall] Remote track: video enabled: true readyState: live
[VideoCall] Remote track: audio enabled: true readyState: live
```

**Problem Signs:**
```
[WebRTC] Received remote track: video readyState: ended
[VideoCall] Attaching remote stream, tracks: 0
[WebRTC] Received track but no stream!
```

### Common Issues and Solutions

#### 1. Remote Video Shows Briefly Then Disappears

**Symptom:** You see the remote video for a second, then it vanishes.

**Cause:** The remote peer stopped their camera or the track ended.

**Debug:**
- Check console for "readyState: ended"
- Ask the other person to check if their camera is still on
- Look for errors about permission denied on their side

#### 2. No Remote Video Ever Appears

**Symptom:** You see "Connected" badge but no video in the small window.

**Cause:** Either tracks aren't arriving or WebRTC connection failed.

**Debug:**
1. Check console for "[WebRTC] Received remote track" - should see 2 (video + audio)
2. Check connection state: Should be "connected"
3. Verify both peers are in the same session/room
4. Check if the other peer has their camera on

**Quick Test:**
```javascript
// In browser console on the page with the issue:
const videoEl = document.querySelector('video[class*="bottom-4"]'); // Remote video
console.log('Video element:', videoEl);
console.log('Has stream:', !!videoEl?.srcObject);
console.log('Stream tracks:', videoEl?.srcObject?.getTracks());
```

#### 3. Audio Works But No Video

**Symptom:** You can hear the other person but don't see them.

**Cause:** Only audio track is being sent.

**Debug:**
- Check remote peer's camera permissions
- Look for: `[WebRTC] Stream tracks: audio:live` (should also show `video:live`)
- Remote peer may have denied camera access

#### 4. "Connected" Appears But Nothing Happens

**Symptom:** Green "Connected" badge shows but no video stream.

**Cause:** The remoteStream object exists but has no tracks, or tracks are "ended".

**Debug:**
```javascript
// Check in console:
// This will show all video elements and their stream status
document.querySelectorAll('video').forEach((v, i) => {
  console.log(`Video ${i}:`, {
    srcObject: !!v.srcObject,
    tracks: v.srcObject?.getTracks().map(t => ({
      kind: t.kind,
      enabled: t.enabled,
      readyState: t.readyState
    }))
  });
});
```

## Testing Checklist

Use this checklist when testing video calls:

### Device 1 (Sender):
- [ ] Access via localhost:3000 or HTTPS URL
- [ ] Click "Turn camera on"
- [ ] Grant camera/microphone permissions
- [ ] See your own video in main view
- [ ] Note the session ID in URL

### Device 2 (Receiver):
- [ ] Access same session ID (copy full URL from Device 1)
- [ ] Click "Turn camera on"
- [ ] Grant camera/microphone permissions
- [ ] See your own video in main view
- [ ] Within 2-3 seconds, should see "Connected" badge
- [ ] Within 5 seconds, should see Device 1's video in small window

### Both Devices:
- [ ] Check browser console for errors (F12)
- [ ] Verify "[WebRTC] Connection state changed: connected"
- [ ] Verify both devices show "Connected" badge
- [ ] Try sending chat messages both directions

## Network Requirements

### Firewall/NAT
- STUN servers must be reachable (Google's STUN at port 19302)
- UDP ports must not be blocked
- For complex NATs, you may need a TURN server

### Browser Compatibility
- Chrome/Edge: Full support ✅
- Firefox: Full support ✅
- Safari: Works but may have quirks ⚠️
- Mobile browsers: Require HTTPS (use ngrok)

## Advanced Debugging

### Check ICE Candidate Exchange

```javascript
// In browser console, monitor ICE candidates:
const pc = // Get RTCPeerConnection (you'll need to expose this)
pc.addEventListener('icecandidate', (e) => {
  if (e.candidate) {
    console.log('ICE Candidate:', e.candidate.candidate);
  }
});
```

### Monitor Connection States

```javascript
// Track all WebRTC states
const pc = // RTCPeerConnection
console.log('Connection State:', pc.connectionState);
console.log('ICE Connection State:', pc.iceConnectionState);
console.log('ICE Gathering State:', pc.iceGatheringState);
console.log('Signaling State:', pc.signalingState);
```

### Expected State Progression

```
1. Signaling State: stable → have-local-offer → stable
2. ICE Gathering State: new → gathering → complete
3. ICE Connection State: new → checking → connected
4. Connection State: new → connecting → connected
```

If stuck at any state, there's a network or signaling issue.

## Still Having Issues?

1. **Clear browser cache** and reload
2. **Try incognito/private mode** to rule out extensions
3. **Check both devices are on same WiFi** (or both using ngrok HTTPS)
4. **Verify backend is running** at correct URL
5. **Check WebSocket connection** - should see "Connected" in UI
6. **Try with different browser** to isolate browser-specific issues

## Tips for Reliable Video Calls

1. **Always use localhost or HTTPS** for media access
2. **Same session ID** on both devices
3. **Turn camera on** before expecting remote video
4. **Wait 5-10 seconds** after connection for video to stabilize
5. **Check console logs** - they tell you exactly what's happening
6. **Stable network** - avoid switching WiFi during call
