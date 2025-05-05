// server/index.js
const express       = require('express');
const http          = require('http');
const cors          = require('cors');
const path          = require('path');
require('dotenv').config();

const authRoutes     = require('./auth');
const usersRoutes    = require('./routes/users');
const roomsRoutes    = require('./routes/rooms');
const messagesRoutes = require('./routes/messages');
const setupWebSocket = require('./chat');

const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// 1) API
app.use('/api',          authRoutes);
app.use('/api/users',    usersRoutes);
app.use('/api/rooms',    roomsRoutes);
app.use('/api/messages', messagesRoutes);

// 2) Статика
app.use(express.static(path.join(__dirname, 'client')));

// 3) SPA fallback (не для /api/*)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// WebSocket
setupWebSocket(server);
