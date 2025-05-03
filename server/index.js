// server/index.js
const express       = require('express');
const http          = require('http');
const cors          = require('cors');
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

const path = require('path');

// 1) В первую очередь — API
app.use('/api', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/messages', messagesRoutes);

// 2) Затем — раздача статики клиентской части
app.use(express.static(path.join(__dirname, 'client')));

// 3) И в самом конце any-route -> index.html (для поддержки client-side роутинга)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Запуск HTTP + WebSocket
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
setupWebSocket(server);
