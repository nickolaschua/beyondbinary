// shared/constants.js
// Shared constants between client and server

export const SOCKET_EVENTS = {
  // Connection
  JOIN_ROOM: 'join-room',
  ROOM_FULL: 'room-full',
  ROOM_JOINED: 'room-joined',
  PEER_JOINED: 'peer-joined',
  PEER_LEFT: 'peer-left',
  
  // Signaling
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
};

export const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export const MAX_ROOM_SIZE = 2;
