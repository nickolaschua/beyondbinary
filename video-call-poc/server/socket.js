// server/socket.js
// Socket.IO signaling only - no media handling

const { joinRoom, leaveRoom, getRoomPeers, getRoomForSocket } = require('./rooms');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    socket.onAny((event, ...args) => {
      console.log(`  [${socket.id}] → ${event}`, args.length ? args : '');
    });

    socket.on('join-room', (roomId) => {
      const result = joinRoom(roomId, socket.id);
      
      if (!result.success) {
        socket.emit('room-full');
        return;
      }
      
      socket.join(roomId);
      socket.emit('room-joined', { roomId });
      
      // Notify existing peer
      const peers = getRoomPeers(roomId, socket.id);
      if (peers.length > 0) {
        const peerId = peers[0];
        io.to(peerId).emit('peer-joined', { peerId: socket.id });
      }
      
      console.log(`Socket ${socket.id} joined room ${roomId} (${result.roomSize}/2)`);
    });
    
    // Forward WebRTC signaling messages
    socket.on('offer', ({ target, offer }) => {
      io.to(target).emit('offer', { from: socket.id, offer });
    });
    
    socket.on('answer', ({ target, answer }) => {
      io.to(target).emit('answer', { from: socket.id, answer });
    });
    
    socket.on('ice-candidate', ({ target, candidate }) => {
      io.to(target).emit('ice-candidate', { from: socket.id, candidate });
    });
    
    socket.on('disconnect', () => {
      const roomId = getRoomForSocket(socket.id);
      if (roomId) {
        leaveRoom(roomId, socket.id);
        
        // Notify remaining peer
        const peers = getRoomPeers(roomId, socket.id);
        peers.forEach(peerId => {
          io.to(peerId).emit('peer-left', { peerId: socket.id });
        });
        
        console.log(`Socket ${socket.id} left room ${roomId}`);
      }
    });
  });
}

module.exports = { setupSocketHandlers };
