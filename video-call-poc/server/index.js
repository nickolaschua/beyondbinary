// server/index.js
// Bootstrap Express + Socket.IO only

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { PORT } = require('./config');
const { setupSocketHandlers } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

// Setup Socket.IO handlers
setupSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
