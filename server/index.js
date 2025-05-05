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
const filesRoutes    = require('./routes/files');    // <— новый роутер для файлов
const setupWebSocket = require('./chat');

const app    = express();
const server = http.createServer(app);

// 1) Middleware
app.use(cors());
app.use(express.json());

// 2) API-маршруты
app.use('/api',          authRoutes);
app.use('/api/users',    usersRoutes);
app.use('/api/rooms',    roomsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/files',    filesRoutes);               // <— подключили роутер загрузки/скачивания файлов

// 3) Раздача загруженных файлов
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// 4) Статика клиентской части
app.use(express.static(path.join(__dirname, 'client')));

// 5) SPA fallback (все что не /api/* и не /uploads/*)
app.get(/^\/(?!api|uploads).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// 6) Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 7) WebSocket
setupWebSocket(server);
