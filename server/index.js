// server/index.js
const express       = require('express');
const http          = require('http');
const cors          = require('cors');
const path          = require('path');
require('dotenv').config();
const axios = require('axios'); 
const authRoutes     = require('./auth');
const usersRoutes    = require('./routes/users');
const messagesRoutes = require('./routes/messages');
const callsRouter    = require('./routes/calls');
const roomsRoutes    = require('./routes/rooms');
const filesRoutes    = require('./routes/files');
const eventsRouter = require('./routes/events');
const notesRouter = require('./routes/notes');
const { setupWebSocket } = require('./chat');

const app    = express();
const server = http.createServer(app);

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;

// Маршрут для проверки reCAPTCHA

// 1) Middleware
app.use(cors());
// важно: JSON-парсер должен быть ДО роутов, обрабатывающих POST /calls и POST /messages
app.use(express.json());
// --- логируем каждый входящий запрос и его тело (если есть)
app.use((req, res, next) => {
  console.log(`→ ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.body).length) {
    console.log('   Body:', JSON.stringify(req.body));
  }
  next();
});
// --- ловим ошибки разбора JSON
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    console.error('❌ JSON parse error:', err);
    return res.status(400).send('Invalid JSON');
  }
  next(err);
});

// 2) API
app.post('/api/verify-captcha', async (req, res) => {
    try {
        console.log('Request body:', req.body); // Добавьте для отладки
        
        if (!req.body || !req.body.captcha) {
            console.error('CAPTCHA token is missing');
            return res.status(400).json({ 
                success: false, 
                'error-codes': ['missing-input-response'] 
            });
        }
        
        const { captcha } = req.body;
        console.log('Verifying CAPTCHA:', captcha); // Логирование токена
        
        const response = await axios.post(
            'https://www.google.com/recaptcha/api/siteverify',
            null,
            {
                params: {
                    secret: process.env.RECAPTCHA_SECRET,
                    response: captcha
                }
            }
        );
        
        console.log('CAPTCHA verification response:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('CAPTCHA verification error:', error);
        res.status(500).json({ 
            success: false, 
            'error-codes': ['server-error'] 
        });
    }
});


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
const fs = require('fs');

// Логи для диагностики
console.log('== SERVER __dirname =', __dirname);
const miniPath = path.join(__dirname, 'miniapps');
console.log('== Serving miniapps from', miniPath);
try {
  console.log('== miniapps contents:', fs.readdirSync(miniPath));
} catch (e) {
  console.error('!! Cannot read miniapps dir:', e.message);
}

app.use(
  '/miniapps',
  express.static(path.join(__dirname, 'miniapps'))
);
app.use('/events', eventsRouter);
app.use('/notes', notesRouter);
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
