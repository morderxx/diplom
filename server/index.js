// server/index.js
const express       = require('express');
const http          = require('http');
const cors          = require('cors');
const path          = require('path');
require('dotenv').config();

const authRoutes     = require('./auth');
const usersRoutes    = require('./routes/users');
const messagesRoutes = require('./routes/messages');
const callsRouter    = require('./routes/calls');
const roomsRoutes    = require('./routes/rooms');
const filesRoutes    = require('./routes/files');

const { setupWebSocket } = require('./chat');

const app    = express();
const server = http.createServer(app);

// 1) Middleware
app.use(cors());
// важно: JSON-парсер должен быть ДО роутов, обрабатывающих POST /calls и POST /messages
app.use(express.json());

// 2) API

// аутентификация
app.use('/api', authRoutes);

// пользователи
app.use('/api/users', usersRoutes);

// сообщения в комнатах:  
//      POST /api/rooms/:roomId/messages
//      GET  /api/rooms/:roomId/messages
app.use('/api/rooms', messagesRoutes);

// звонки в комнатах:
//      POST /api/rooms/:roomId/calls
//      GET  /api/rooms/:roomId/calls
app.use('/api/rooms', callsRouter);

// остальные операции с комнатами:
//      GET /api/rooms
//      POST /api/rooms
//      и т.п.
app.use('/api/rooms', roomsRoutes);

// файлы
app.use('/api/files', filesRoutes);

// 3) Статика клиентской части
app.use(express.static(path.join(__dirname, 'client')));

// 4) SPA fallback — всё, что не /api, отдадим клиентский index.html
app.get(/^\/(?!api).*/, (req, res) =>
  res.sendFile(path.join(__dirname, 'client', 'index.html'))
);

// 5) Запуск HTTP и WebSocket
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
setupWebSocket(server);
