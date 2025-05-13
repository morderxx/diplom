const express   = require('express');
const pool      = require('../db');
const jwt       = require('jsonwebtoken');
const { getWss } = require('../chat');
const router    = express.Router();
const JWT\_SECRET = process.env.JWT\_SECRET || 'secret123';

// Middleware: из токена достаём login
async function authMiddleware(req, res, next) {
const auth = req.headers.authorization;
if (!auth) return res.status(401).send('No token');
try {
const token   = auth.split(' ')\[1];
const payload = jwt.verify(token, JWT\_SECRET);
req.userLogin = payload.login;
next();
} catch (err) {
console.error('JWT error:', err);
res.status(401).send('Invalid token');
}
}

// POST /api/rooms/\:roomId/calls — сохранить звонок и расслать по WS
router.post('/\:roomId/calls', authMiddleware, async (req, res) => {
const roomId    = +req.params.roomId;
const { initiator, recipient, started\_at, ended\_at, status, duration } = req.body;

try {
// Сохраняем звонок
const { rows } = await pool.query(
`INSERT INTO calls
         (room_id, initiator, recipient, started_at, ended_at, status, duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, initiator, recipient, started_at, ended_at, status, duration`,
\[roomId, initiator, recipient, started\_at, ended\_at, status, duration]
);
const call = rows\[0];

```
// Отправляем ответ клиенту
res.status(201).json(call);

// Рассылаем событие через WebSocket
const wss = getWss();
if (wss) {
  const msg = {
    type:       'call',
    initiator:  call.initiator,
    recipient:  call.recipient,
    started_at: call.started_at,
    ended_at:   call.ended_at,
    status:     call.status,
    duration:   call.duration
  };
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(msg));
    }
  });
}
```

} catch (err) {
console.error('Error saving call:', err);
res.status(500).send('Error saving call');
}
});

// GET /api/rooms/\:roomId/calls — получить историю звонков
router.get('/\:roomId/calls', authMiddleware, async (req, res) => {
const roomId = +req.params.roomId;
try {
const { rows } = await pool.query(
`SELECT id, initiator, recipient, started_at, ended_at, status, duration
         FROM calls
        WHERE room_id = $1
        ORDER BY started_at`,
\[roomId]
);
res.json(rows);
} catch (err) {
console.error('Error fetching calls:', err);
res.status(500).send('Error fetching calls');
}
});

module.exports = router;
