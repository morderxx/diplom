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
const callsRouter = require('./routes/calls');

const setupWebSocket = require('./chat');

const app    = express();
const server = http.createServer(app);

// 1) Middleware
app.use(cors());
app.use(express.json());

// 2) API
app.use('/api/auth',      authRoutes);                     // /api/auth/login, /api/auth/register и т.д.
app.use('/api/users',     usersRoutes);                    // /api/users      (здесь уже стоит authMiddleware)
app.use('/api/rooms/:roomId/messages', messagesRoutes);    // /api/rooms/123/messages
app.use('/api/rooms/:roomId/calls',    callsRouter);       // /api/rooms/123/calls
app.use('/api/rooms',     roomsRoutes);                    // /api/rooms, /api/rooms/:roomId и т.п.
app.use('/api/files',     filesRoutes);                    // /api/files


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
