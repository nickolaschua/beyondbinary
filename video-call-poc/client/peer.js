// client/peer.js
// RTCPeerConnection logic only

const STUN_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Free TURN servers for relay when direct connection fails
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

class PeerConnection {
  constructor(peerId, localStream, signalingClient) {
    this.peerId = peerId;
    this.pc = new RTCPeerConnection(STUN_CONFIG);
    this.signalingClient = signalingClient;
    this.iceCandidateQueue = [];

    // Add local tracks
    localStream.getTracks().forEach(track => {
      this.pc.addTrack(track, localStream);
    });

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingClient.sendIceCandidate(event.candidate, this.peerId);
      }
    };

    // Handle remote stream (support both streams[0] and track-only)
    this.pc.ontrack = (event) => {
      if (this.onRemoteStream) {
        const stream = event.streams && event.streams[0]
          ? event.streams[0]
          : new MediaStream([event.track]);
        this.onRemoteStream(stream);
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[Peer]', this.peerId, 'connection state:', this.pc.connectionState);
      if (this.pc.connectionState === 'failed') {
        console.warn('[Peer] Connection failed - check firewall/network');
      }
      if (this.pc.connectionState === 'connected') {
        console.log('✅ [Peer] Successfully connected to', this.peerId);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[Peer]', this.peerId, 'ICE state:', this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'failed') {
        console.error('❌ [Peer] ICE connection failed - TURN server may be needed');
      }
    };

    this.pc.onicegatheringstatechange = () => {
      console.log('[Peer]', this.peerId, 'ICE gathering:', this.pc.iceGatheringState);
    };
  }

  async flushIceCandidates() {
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Failed to add ICE candidate:', err);
      }
    }
  }
  
  async createOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }
  
  async handleOffer(offer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushIceCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushIceCandidates();
  }

  async handleIceCandidate(candidate) {
    if (this.pc.remoteDescription) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Failed to add ICE candidate:', err);
      }
    } else {
      this.iceCandidateQueue.push(candidate);
    }
  }
  
  close() {
    this.pc.close();
  }
}

export { PeerConnection };
