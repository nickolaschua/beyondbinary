// server/config.js
// Server configuration - STUN only

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const MAX_ROOM_SIZE = 2;

// Use 3001 so it doesn't clash with backend (8000) or other apps on 3000
module.exports = {
  STUN_SERVERS,
  MAX_ROOM_SIZE,
  PORT: process.env.PORT || 3001,
};
