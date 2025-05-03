// server/routes/messages.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: проверяем JWT, сохраняем req.userId
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId    = payload.id;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// POST /api/messages/:messageId/read — пометить сообщение прочитанным
router.post('/:messageId/read', authMiddleware, async (req, res) => {
  const { messageId } = req.params;
  try {
    // Проверяем, что пользователь участник комнаты этого сообщения
    // Сначала находим room_id
    const mres = await pool.query(
      'SELECT room_id FROM messages WHERE id = $1',
      [messageId]
    );
    if (mres.rowCount === 0) {
      return res.status(404).send('Message not found');
    }
    const roomId = mres.rows[0].room_id;

    // Получаем nickname текущего пользователя
    const ures = await pool.query(
      'SELECT nickname FROM users WHERE id = $1',
      [req.userId]
    );
    const myNick = ures.rows[0]?.nickname;
    if (!myNick) {
      return res.status(500).send('Your nickname missing');
    }

    // Проверяем членство
    const mem = await pool.query(
      `SELECT 1 FROM room_members
         WHERE room_id = $1 AND nickname = $2`,
      [roomId, myNick]
    );
    if (mem.rowCount === 0) {
      return res.status(403).send('Not a member');
    }

    // Обновляем флаг is_read
    await pool.query(
      'UPDATE messages SET is_read = TRUE WHERE id = $1',
      [messageId]
    );
    res.send('OK');
  } catch (err) {
    console.error('Error marking message read:', err);
    res.status(500).send('Error marking message read');
  }
});

module.exports = router;
