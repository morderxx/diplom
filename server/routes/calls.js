const express   = require('express');
const pool      = require('../db');
const jwt       = require('jsonwebtoken');
const { getWss } = require('../chat');
const router    = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: из токена достаём login
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;
    next();
  } catch (err) {
    console.error('JWT error:', err);
    res.status(401).send('Invalid token');
  }
}

// POST /api/rooms/:roomId/calls — сохранить звонок, добавить в сообщения и расслать по WS
router.post('/:roomId/calls', authMiddleware, async (req, res) => {
  const roomId    = +req.params.roomId;
  const { initiator, recipient, started_at, ended_at, status, duration } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Сохраняем звонок
    const { rows: [call] } = await client.query(
      `INSERT INTO calls
         (room_id, initiator, recipient, started_at, ended_at, status, duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, started_at`,
      [roomId, initiator, recipient, started_at, ended_at, status, duration]
    );

    // 2) Добавляем запись в messages для унифицированной истории
    await client.query(
      `INSERT INTO messages
         (room_id, sender_nickname, call_id, time)
       VALUES ($1, $2, $3, $4)`,
      [roomId, initiator, call.id, call.started_at]
    );

    await client.query('COMMIT');

    // 3) Возвращаем сохранённый звонок клиенту
    res.status(201).json(call);

    // 4) Рассылаем событие через WebSocket всем клиентам
    const wss = getWss();
    if (wss) {
      const msg = {
        type:       'call',
        initiator,
        recipient,
        started_at,
        ended_at,
        status,
        duration
      };
      wss.clients.forEach(clientWs => {
        if (clientWs.readyState === clientWs.OPEN) {
          clientWs.send(JSON.stringify(msg));
        }
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving call:', err);
    res.status(500).send('Error saving call');
  } finally {
    client.release();
  }
});

// GET /api/rooms/:roomId/calls — получить историю звонков (если нужно отдельно)
router.get('/:roomId/calls', authMiddleware, async (req, res) => {
  const roomId = +req.params.roomId;
  try {
    const { rows } = await pool.query(
      `SELECT id, initiator, recipient, started_at, ended_at, status, duration
         FROM calls
        WHERE room_id = $1
        ORDER BY started_at`,
      [roomId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching calls:', err);
    res.status(500).send('Error fetching calls');
  }
});

module.exports = router;
