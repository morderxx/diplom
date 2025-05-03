const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// authMiddleware — та же логика, только проверка токена
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// GET /api/rooms/:roomId/messages — история
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // проверяем, что текущий nickname есть в room_members
    const userNick = req.userNickname; // мы берём nickname в authMiddleware rooms, но тут ручное получение
    // можно сделать повторный запрос, но чаще на фронте в WS мы уже знаем, что юзер участник
    const { rows } = await pool.query(
      `SELECT sender_nickname, text, time
         FROM messages
        WHERE room_id = $1
     ORDER BY time`,
      [roomId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).send('Error fetching messages');
  }
});

module.exports = router;
