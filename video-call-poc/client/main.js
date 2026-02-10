// client/main.js
// Orchestration: socket + media + peer

import { SignalingClient } from './signaling.js';
import { getLocalMedia } from './media.js';
import { PeerConnection } from './peer.js';
import { BackendConnector } from './ai/backendConnector.js';
import { attachLocalStream, attachRemoteStream } from './ui/video.js';
import { Controls } from './ui/controls.js';
import {
  displayCaption,
  displayLiveCaption,
  updateToneIndicator,
  setCaptionsMode,
  setListeningState,
  addUtterance,
  updateUtteranceTone,
} from './ui/captions.js';

class VideoCallApp {
  constructor() {
    this.signaling = new SignalingClient('http://localhost:3001');
    this.localStream = null;
    this.peerConnection = null;
    this.controls = null;
    this.backendConnector = new BackendConnector();
  }
  
  async init() {
    try {
      // Get local media
      console.log('Requesting camera/microphone access...');
      const media = await getLocalMedia();
      this.localStream = media.stream;
      console.log('Media access granted');

      // Display local video
      attachLocalStream(this.localStream);
      console.log('Local video attached');
    } catch (error) {
      console.error('Media access error:', error);
      alert(`Camera/microphone access denied: ${error.message}\n\nPlease allow camera/microphone access and refresh.`);
      throw error;
    }
    
    // Setup controls
    this.controls = new Controls(this.localStream);
    document.getElementById('toggle-audio')?.addEventListener('click', () => {
      this.controls.toggleAudio();
    });
    document.getElementById('toggle-video')?.addEventListener('click', () => {
      this.controls.toggleVideo();
    });
    
    // Connect LOCAL audio to backend only (no sample/placeholder fallback)
    const localAudioTrack = this.localStream.getAudioTracks()[0];
    if (localAudioTrack) {
      this.backendConnector.onTranscript = (payload) => {
        const text = typeof payload === 'string' ? payload : payload?.text;
        if (text && text.trim()) {
          displayCaption(`[You] ${text.trim()}`, 'local');
          if (payload?.utterance_id) {
            const rawTone = payload.tone;
            const realTone =
              rawTone != null &&
              rawTone !== '' &&
              !['analyzing...', 'interim'].includes(String(rawTone))
                ? { label: String(rawTone), confidence: payload.confidence ?? 0 }
                : undefined;
            addUtterance(payload.utterance_id, text.trim(), realTone);
          }
        }
      };
      this.backendConnector.onToneUpdate = (data) => {
        if (data && data.tone) {
          updateToneIndicator(data.tone);
          if (data.utterance_id) {
            updateUtteranceTone(data.utterance_id, { label: data.tone, confidence: data.confidence ?? 0 });
          }
        }
      };
      this.backendConnector.onLiveCaption = (text, isFinal) => {
        displayLiveCaption(text, isFinal);
      };
      this.backendConnector.onStatus = (message) => {
        setListeningState(message === 'listening');
      };
      this.backendConnector.onError = (msg) => {
        console.error('[Backend]', msg);
        setCaptionsMode('offline');
        displayCaption('[You] Backend error: ' + msg, 'local');
        updateToneIndicator('—');
      };
      try {
        const audioOnlyStream = new MediaStream([this.localStream.getAudioTracks()[0]]);
        await this.backendConnector.start(audioOnlyStream);
        setCaptionsMode('live');
        displayCaption('[You] Listening... (speak to see captions)', 'local');
        updateToneIndicator('analyzing...');
        console.log('Backend connected: real captions + tone');
      } catch (err) {
        console.error('Backend not available:', err.message);
        setCaptionsMode('offline');
        displayCaption('Start backend: cd backend && uvicorn app.main:app --port 8000 — then refresh', 'local');
        updateToneIndicator('—');
      }
    }

    // Setup signaling handlers (required for remote connection)
    this.setupSignalingHandlers();
  }
  
  setupSignalingHandlers() {
    this.signaling.on('room-joined', ({ roomId }) => {
      console.log('Joined room:', roomId);
    });
    
    this.signaling.on('room-full', () => {
      alert('Room is full (2/2)');
    });
    
    this.signaling.on('peer-joined', async ({ peerId }) => {
      console.log('Peer joined:', peerId);

      // Create peer connection and send offer
      this.peerConnection = new PeerConnection(peerId, this.localStream, this.signaling);
      this.peerConnection.onRemoteStream = (remoteStream) => {
        attachRemoteStream(remoteStream);
      };

      const offer = await this.peerConnection.createOffer();
      this.signaling.sendOffer(peerId, offer);
    });

    this.signaling.on('offer', async ({ from, offer }) => {
      console.log('Received offer from:', from);

      // Create peer connection and send answer
      this.peerConnection = new PeerConnection(from, this.localStream, this.signaling);
      this.peerConnection.onRemoteStream = (remoteStream) => {
        attachRemoteStream(remoteStream);
      };

      const answer = await this.peerConnection.handleOffer(offer);
      this.signaling.sendAnswer(from, answer);
    });
    
    this.signaling.on('answer', async ({ from, answer }) => {
      console.log('Received answer from:', from);
      await this.peerConnection.handleAnswer(answer);
    });
    
    this.signaling.on('ice-candidate', async ({ from, candidate }) => {
      if (this.peerConnection) {
        await this.peerConnection.handleIceCandidate(candidate);
      }
    });
    
    this.signaling.on('peer-left', () => {
      console.log('Peer left');
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      const remoteVideo = document.getElementById('remote-video');
      if (remoteVideo) remoteVideo.srcObject = null;
    });
  }
  
  joinRoom(roomId) {
    this.signaling.joinRoom(roomId);
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing Video Call App...');
    const app = new VideoCallApp();
    await app.init();

    // Auto-join room from URL or use default
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room') || 'default-room';
    console.log('Joining room:', roomId);
    app.joinRoom(roomId);
  } catch (error) {
    console.error('App initialization failed:', error);
  }
});
