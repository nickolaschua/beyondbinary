// client/signaling.js
// Socket.IO client adapter for signaling

class SignalingClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.socket = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    this.handlers = {};
    this.roomId = null;
    this.socket.on('connect', () => {
      console.log('[Signaling] Connected to', this.serverUrl);
      if (this.roomId) {
        console.log('[Signaling] Joining room:', this.roomId);
        this.socket.emit('join-room', this.roomId);
      }
    });
    this.socket.on('connect_error', (err) => {
      console.error('[Signaling] Connection failed:', err.message);
    });
    this.socket.on('disconnect', (reason) => {
      console.warn('[Signaling] Disconnected:', reason);
    });
  }

  on(event, handler) {
    this.handlers[event] = handler;
    this.socket.on(event, handler);
  }

  emit(event, data) {
    this.socket.emit(event, data);
  }

  joinRoom(roomId) {
    this.roomId = roomId;
    if (this.socket.connected) {
      console.log('[Signaling] Joining room:', roomId);
      this.socket.emit('join-room', roomId);
    }
  }
  
  sendOffer(target, offer) {
    this.socket.emit('offer', { target, offer });
  }
  
  sendAnswer(target, answer) {
    this.socket.emit('answer', { target, answer });
  }
  
  sendIceCandidate(target, candidate) {
    this.socket.emit('ice-candidate', { target, candidate });
  }
}

export { SignalingClient };
