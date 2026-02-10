// client/media.js
// getUserMedia wrapper - returns full stream + audio track

async function getLocalMedia(constraints = { video: true, audio: true }) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const audioTrack = stream.getAudioTracks()[0];
    
    return {
      stream,
      audioTrack,
      videoTrack: stream.getVideoTracks()[0]
    };
  } catch (error) {
    console.error('Media access error:', error);
    throw error;
  }
}

function stopMediaStream(stream) {
  stream.getTracks().forEach(track => track.stop());
}

export { getLocalMedia, stopMediaStream };
