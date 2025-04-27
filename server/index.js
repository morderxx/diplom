const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./auth');
const setupWebSocket = require('./chat');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
const path = require('path');

// Раздача статики из папки client
app.use(express.static(path.join(__dirname, 'client')));

// Все маршруты (кроме /api) отправлять на index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.use('/api', authRoutes);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Подключаем WebSocket
setupWebSocket(server);
