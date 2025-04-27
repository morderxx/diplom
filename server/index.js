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

app.use('/api', authRoutes);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Подключаем WebSocket
setupWebSocket(server);
