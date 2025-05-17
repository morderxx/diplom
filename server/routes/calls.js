// routes/calls.js

const express    = require('express');
const pool       = require('../db');
const jwt        = require('jsonwebtoken');
const { getWss } = require('../chat');
const router     = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token provided');
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

router.post('/:roomId/calls', authMiddleware, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const { initiator, recipient, started_at, ended_at, status, duration } = req.body;

  try {
    // 1) Сохраняем звонок в таблицу calls
    const { rows: callRows } = await pool.query(`
      INSERT INTO calls
        (room_id, initiator, recipient, started_at, ended_at, status, duration)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, initiator, recipient, started_at, ended_at, status, duration;
    `, [roomId, initiator, recipient, started_at, ended_at, status, duration]);
    const call = callRows[0];

    // 2) Генерируем текст для системного сообщения
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
        text = `${initiator} сбросил(а) вызов`;
        break;
      }
      default:
        text = `Статус звонка: ${status}`;
    }

    // 3) Выбираем время для системного сообщения
    const msgTime = (status === 'finished' || status === 'missed')
      ? ended_at
      : started_at;

    let chatMsg = null;

    // 4) Сохраняем в messages и подготовим для рассылки только если это не пропущенный звонок
    if (status !== 'missed') {
      const { rows: msgRows } = await pool.query(`
        INSERT INTO messages (room_id, sender_nickname, text, time, call_id)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING id, room_id, sender_nickname AS sender, text, time, call_id;
      `, [roomId, initiator, text, msgTime, call.id]);
      chatMsg = msgRows[0];
    }

    // 5) Отправляем клиенту информацию о звонке
    res.status(201).json(call);

    // 6) Бродкастим события по WebSocket
    const wss = getWss();
    if (wss) {
      const callEvent = {
        type:       'call',
        roomId,
        initiator:  call.initiator,
        recipient:  call.recipient,
        started_at: call.started_at,
        ended_at:   call.ended_at,
        status:     call.status,
        duration:   call.duration
      };

      // Всегда шлём событие о звонке
      wss.clients.forEach(client => {
        if (client.readyState === client.OPEN && typeof client.send === 'function') {
          client.send(JSON.stringify(callEvent));
        }
      });

      // А событие message — только если звонок не пропущен
      if (chatMsg) {
        const messageEvent = {
          type:    'message',
          roomId:  chatMsg.room_id,
          sender:  chatMsg.sender,
          text:    chatMsg.text,
          time:    chatMsg.time,
          call_id: chatMsg.call_id
        };
        wss.clients.forEach(client => {
          if (client.readyState === client.OPEN && typeof client.send === 'function') {
            client.send(JSON.stringify(messageEvent));
          }
        });
      }
    }

  } catch (err) {
    console.error('Error in POST /rooms/:roomId/calls:', err);
    if (!res.headersSent) {
      res.status(500).send('Error saving call');
    }
  }
});

// GET /api/rooms/:roomId/calls
router.get('/:roomId/calls', authMiddleware, async (req, res) => {
  const roomId = Number(req.params.roomId);
  try {
    const { rows } = await pool.query(`
      SELECT id, initiator, recipient, started_at, ended_at, status, duration
      FROM calls
      WHERE room_id = $1
      ORDER BY started_at;
    `, [roomId]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching calls:', err);
    res.status(500).send('Error fetching calls');
  }
});

module.exports = router;
