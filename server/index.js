// server/index.js
const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const path       = require('path');
require('dotenv').config();

const authRoutes     = require('./auth');
const usersRoutes    = require('./routes/users');
const roomsRoutes    = require('./routes/rooms');
const messagesRoutes = require('./routes/messages');
const filesRoutes    = require('./routes/files');
const callsRouter    = require('./routes/calls');

const setupWebSocket = require('./chat');

const app    = express();
const server = http.createServer(app);

// 1) Middleware
app.use(cors());
app.use(express.json());

// 2) API
app.use('/api',           authRoutes);
app.use('/api/users',     usersRoutes);

// История сообщений (с реальным call_id)
app.use('/api/messages',  messagesRoutes);

// Операции над комнатами
app.use('/api/rooms',     roomsRoutes);

// Звонки по комнате
app.use('/api/rooms',     callsRouter);

// Файлы
app.use('/api/files',     filesRoutes);

// 3) Статика клиента
app.use(express.static(path.join(__dirname, 'client')));

// 4) SPA fallback
app.get(/^\/(?!api).*/, (req, res) =>
  res.sendFile(path.join(__dirname, 'client', 'index.html'))
);

// 5) Запуск HTTP и WebSocket
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
setupWebSocket(server);
