// server/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const authRoutes     = require('./auth');
const roomsRoutes    = require('./routes/rooms');
const messagesRoutes = require('./routes/messages');
const usersRoutes    = require('./routes/users');
const setupWebSocket = require('./chat');

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());

// API
app.use('/api', authRoutes);             // /api/register, /api/login, /api/profile
app.use('/api/rooms', roomsRoutes);      // /api/rooms/*
app.use('/api/messages', messagesRoutes);// /api/messages/:id/read
app.use('/api/users', usersRoutes);      // /api/users

// Статика клиента
const path = require('path');
app.use(express.static(path.join(__dirname, 'client')));

// SPA fallback — всё, что не /api, отдадим index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Запуск HTTP + WebSocket
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
setupWebSocket(server);
