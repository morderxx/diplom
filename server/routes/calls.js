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
    // 1) Сохраняем звонок
    const { rows: callRows } = await pool.query(`
      INSERT INTO calls
        (room_id, initiator, recipient, started_at, ended_at, status, duration)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, initiator, recipient, started_at, ended_at, status, duration;
    `, [roomId, initiator, recipient, started_at, ended_at, status, duration]);
    const call = callRows[0];

    // 2) Формируем текст
    const durMMSS = (() => {
      const mm = String(Math.floor(duration / 60)).padStart(2, '0');
      const ss = String(duration % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    })();

    let centerText = '';
    let bubbleText = '';

    switch (status) {
      case 'cancelled':
        if (duration === 0) {
          centerText = `📞 Звонок от ${initiator} к ${recipient} был отменен.`;
          bubbleText = `${initiator} отменил(а) звонок`;
        } else {
          centerText = `📞 Звонок от ${initiator} к ${recipient} был сброшен. Длительность ${durMMSS}.`;
          bubbleText = `${initiator} отменил(а) звонок`;
        }
        break;
      case 'missed':
        centerText = `📞 Пропущенный звонок от ${initiator}.`;
        bubbleText = `Пропущенный звонок от ${initiator}`;
        break;
      case 'finished':
        centerText = `📞 Звонок от ${initiator} к ${recipient} завершён. Длительность ${durMMSS}.`;
        bubbleText = `${initiator} завершил(а) звонок.`;
        break;
      default:
        centerText = `📞 Статус звонка: ${status}`;
        bubbleText = `Статус звонка: ${status}`;
    }

    // 3) Сохраняем системное сообщение (bubbleText)
    const { rows: msgRows } = await pool.query(`
      INSERT INTO messages (room_id, sender_nickname, text, time, call_id)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id, room_id, sender_nickname AS sender, text, time, call_id;
    `, [roomId, initiator, bubbleText, started_at, call.id]);
    const chatMsg = msgRows[0];

    // 4) Ответ клиенту
    res.status(201).json(call);

    // 5) WebSocket-уведомление
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
        duration:   call.duration,
        centerText // для отображения по центру
      };
      const messageEvent = {
        type:    'message',
        roomId:  chatMsg.room_id,
        sender:  chatMsg.sender,
        text:    chatMsg.text, // короткий текст
        time:    chatMsg.time,
        call_id: chatMsg.call_id
      };

      wss.clients.forEach(client => {
        if (
          client.readyState === client.OPEN &&
          typeof client.send === 'function'
        ) {
          client.send(JSON.stringify(callEvent));
          client.send(JSON.stringify(messageEvent));
        }
      });
    }

  } catch (err) {
    console.error('Error in POST /rooms/:roomId/calls:', err);
    if (!res.headersSent) {
      res.status(500).send('Error saving call');
    }
  }
});

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
