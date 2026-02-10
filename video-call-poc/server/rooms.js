// server/rooms.js
// Room state management - max 2 users per room

const { MAX_ROOM_SIZE } = require('./config');

const rooms = new Map();

function joinRoom(roomId, socketId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  
  const room = rooms.get(roomId);
  
  if (room.size >= MAX_ROOM_SIZE) {
    return { success: false, reason: 'room_full' };
  }
  
  room.add(socketId);
  return { success: true, roomSize: room.size };
}

function leaveRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  room.delete(socketId);
  
  if (room.size === 0) {
    rooms.delete(roomId);
  }
}

function getRoomPeers(roomId, excludeSocketId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  
  return Array.from(room).filter(id => id !== excludeSocketId);
}

function getRoomForSocket(socketId) {
  for (const [roomId, sockets] of rooms.entries()) {
    if (sockets.has(socketId)) {
      return roomId;
    }
  }
  return null;
}

module.exports = {
  joinRoom,
  leaveRoom,
  getRoomPeers,
  getRoomForSocket,
};
