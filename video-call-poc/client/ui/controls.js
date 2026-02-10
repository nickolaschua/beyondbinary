// client/ui/controls.js
// Mute / camera toggle controls

class Controls {
  constructor(localStream) {
    this.localStream = localStream;
    this.audioEnabled = true;
    this.videoEnabled = true;
  }
  
  toggleAudio() {
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      this.audioEnabled = !this.audioEnabled;
      audioTrack.enabled = this.audioEnabled;
      this.updateUI('audio', this.audioEnabled);
    }
  }
  
  toggleVideo() {
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      this.videoEnabled = !this.videoEnabled;
      videoTrack.enabled = this.videoEnabled;
      this.updateUI('video', this.videoEnabled);
    }
  }
  
  updateUI(type, enabled) {
    const button = document.getElementById(`toggle-${type}`);
    if (button) {
      button.textContent = enabled ? `${type} ON` : `${type} OFF`;
      button.classList.toggle('disabled', !enabled);
    }
  }
}

export { Controls };
