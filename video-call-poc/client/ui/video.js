// client/ui/video.js
// Attach streams to video elements

function attachLocalStream(stream) {
  const video = document.getElementById('local-video');
  if (video) {
    video.srcObject = stream;
    video.muted = true; // Prevent echo
  }
}

function attachRemoteStream(stream) {
  const video = document.getElementById('remote-video');
  if (video) {
    video.srcObject = stream;
    video.play().catch(() => {}); // some browsers need explicit play
  }
}

function detachAllStreams() {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  });
}

export { attachLocalStream, attachRemoteStream, detachAllStreams };
