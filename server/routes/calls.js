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

  try {
    // 1) Сохраняем звонок
    const { rows } = await pool.query(
      `INSERT INTO calls
         (room_id, initiator, recipient, started_at, ended_at, status, duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, initiator, recipient, started_at, ended_at, status, duration`,
      [roomId, initiator, recipient, started_at, ended_at, status, duration]
    );
    const call = rows[0];

    // 2) Генерируем текст уведомления
    let text;
    switch (status) {
      case 'cancelled':
        text = `${initiator} отменил(а) звонок`;
        break;
      case 'missed':
        text = `Пропущенный звонок от ${initiator}`;
        break;
      case 'finished': {
        const mm = String(Math.floor(duration / 60)).padStart(2, '0');
        const ss = String(duration % 60).padStart(2, '0');
        text = `Звонок с ${recipient} завершён. Длительность ${mm}:${ss}`;
        break;
      }
      default:
        text = `Статус звонка: ${status}`;
    }

    // 3) Вставляем системное сообщение в messages
    await pool.query(
      `INSERT INTO messages
         (room_id, sender_nickname, text, time, call_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [roomId, initiator, text, started_at, call.id]
    );

    // 4) Отправляем ответ клиенту с данными звонка
    res.status(201).json(call);

    // 5) Рассылаем событие через WebSocket
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

  } catch (err) {
    console.error('Error saving call:', err);
    res.status(500).send('Error saving call');
  }
});

// GET /api/rooms/:roomId/calls — получить историю звонков
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
