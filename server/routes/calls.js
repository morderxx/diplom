// server/routes/calls.js
const express = require('express');
const pool    = require('../db');
const jwt     = require('jsonwebtoken');
const { getWss } = require('../chat');
const router  = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: извлечение login из токена
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

// Helper: формирует текст системного уведомления для звонка
function formatCallMessage({ initiator, recipient, status, duration, canceler }) {
  const initiatorTag = `@${initiator}`;
  const recipientTag = `@${recipient}`;
  const mm = String(Math.floor(duration / 60)).padStart(2, '0');
  const ss = String(duration % 60).padStart(2, '0');
  switch (status) {
    case 'cancelled':
      // если звонок отменён и продолжительности нет
      if (duration === 0) {
        return `📞 Звонок от ${initiatorTag} к ${recipientTag} был отменён.`;
      }
      // звонок был сброшен после соединения
      const cancelerTag = canceler ? ` @${canceler}` : '';
      return `📞 Звонок от ${initiatorTag} к ${recipientTag} был сброшен.${cancelerTag} Длительность ${mm}:${ss}.`;
    case 'missed':
      return `📞 Пропущенный звонок от ${initiatorTag} к ${recipientTag}.`;
    case 'finished':
      return `📞 Звонок от ${initiatorTag} к ${recipientTag} завершён. Длительность ${mm}:${ss}.`;
    default:
      return `📞 Статус звонка: ${status}.`;
  }
}) {
  const initiatorTag = `@${initiator}`;
  const recipientTag = `@${recipient}`;
  switch (status) {
    case 'cancelled':
      return `📞 Звонок от ${initiatorTag} к ${recipientTag} был отменён.`;
    case 'missed':
      return `📞 Пропущенный звонок от ${initiatorTag} к ${recipientTag}.`;
    case 'finished': {
      const mm = String(Math.floor(duration / 60)).padStart(2, '0');
      const ss = String(duration % 60).padStart(2, '0');
      return `📞 Звонок от ${initiatorTag} к ${recipientTag} завершён. Продолжительность ${mm}:${ss}.`;
    }
    default:
      return `📞 Статус звонка: ${status}.`;
  }
}

// POST /api/rooms/:roomId/calls — создать новый звонок
router.post('/:roomId/calls', authMiddleware, async (req, res) => {
  const roomId   = Number(req.params.roomId);
  const { initiator, recipient, started_at, ended_at, status, duration } = req.body;

  try {
    // 1) Генерация текста системного уведомления
    const messageText = formatCallMessage({ initiator, recipient, status, duration });

    // 2) Сохранение звонка с текстом уведомления
    const { rows: [call] } = await pool.query(
      `INSERT INTO calls
         (room_id, initiator, recipient, started_at, ended_at, status, duration, message_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, initiator, recipient, started_at, ended_at, status, duration, message_text;`,
      [roomId, initiator, recipient, started_at, ended_at, status, duration, messageText]
    );

    // 3) Ответ клиенту данными о только что созданном звонке
    res.status(201).json(call);

    // 4) Рассылка события через WebSocket
    const wss = getWss();
    if (wss) {
      const callEvent = {
        type:         'call',
        id:           call.id,
        initiator:    call.initiator,
        recipient:    call.recipient,
        started_at:   call.started_at,
        ended_at:     call.ended_at,
        status:       call.status,
        duration:     call.duration,
        message_text: call.message_text
      };
      wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(callEvent));
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
  const roomId = Number(req.params.roomId);
  try {
    const { rows } = await pool.query(
      `SELECT id, initiator, recipient, started_at, ended_at, status, duration, message_text
         FROM calls
        WHERE room_id = $1
        ORDER BY started_at;`,
      [roomId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching calls:', err);
    res.status(500).send('Error fetching calls');
  }
});

module.exports = router;
