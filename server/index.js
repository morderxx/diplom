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
const filesRoutes    = require('./routes/files');
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
app.use('/api/files',    filesRoutes);

// 2) Статика
app.use(express.static(path.join(__dirname, 'client')));

// 3) SPA fallback
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

server.listen(process.env.PORT || 3000, () =>
  console.log('Server running')
);
setupWebSocket(server);
