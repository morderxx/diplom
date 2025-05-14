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
const callsRouter    = require('./routes/calls');

const setupWebSocket = require('./chat');

const app    = express();
const server = http.createServer(app);

// 1) Middleware
app.use(cors());
app.use(express.json());

// 2) API

// 2.1 Аутентификация (login/register)
app.use('/api', authRoutes);

// 2.2 Пользователи (защищённый роут)
app.use('/api/users', usersRoutes);

// 2.3 История сообщений в комнате
// GET /api/rooms/:roomId/messages
app.use('/api/rooms/:roomId/messages', messagesRoutes);

// 2.4 Управление звонками в комнате
// POST /api/rooms/:roomId/calls
app.use('/api/rooms/:roomId/calls', callsRouter);

// 2.5 Остальные операции с комнатами
// GET /api/rooms, POST /api/rooms, GET /api/rooms/:roomId и т.п.
app.use('/api/rooms', roomsRoutes);

// 2.6 Файлы
app.use('/api/files', filesRoutes);

// 3) Статика клиента
app.use(express.static(path.join(__dirname, 'client')));

// 4) SPA fallback (все, что не /api)
app.get(/^\/(?!api).*/, (req, res) =>
  res.sendFile(path.join(__dirname, 'client', 'index.html'))
);

// 5) Запуск HTTP и WebSocket
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
setupWebSocket(server);
