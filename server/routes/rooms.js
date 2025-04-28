const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: проверяем токен, получаем userId и nickname
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');

  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    const { rows } = await pool.query(
      'SELECT nickname FROM users WHERE id = $1',
      [req.userId]
    );
    req.userNickname = rows[0]?.nickname;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// POST /api/rooms — создать комнату, members = массив никнеймов
router.post('/', authMiddleware, async (req, res) => {
  const { name, is_group, members } = req.body;
  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  try {
    const roomInsert = await pool.query(
      'INSERT INTO rooms (name, is_group) VALUES ($1,$2) RETURNING id',
      [name || null, is_group]
    );
    const roomId = roomInsert.rows[0].id;

    // Вставляем каждого участника по nickname
    await Promise.all(
      members.map(nick =>
        pool.query(
          'INSERT INTO room_members (room_id, user_login) VALUES ($1,$2)',
          [roomId, nick]
        )
      )
    );

    res.json({ roomId });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).send('Error creating room');
  }
});

// GET /api/rooms — комнаты, в которых состоит текущий пользователь
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.is_group, r.created_at
         FROM rooms r
         JOIN room_members m ON m.room_id = r.id
        WHERE m.user_login = $1
     ORDER BY r.created_at DESC`,
      [req.userNickname]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).send('Error fetching rooms');
  }
});

// GET /api/rooms/:roomId/messages — история сообщений
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    const mem = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id=$1 AND user_login=$2',
      [roomId, req.userNickname]
    );
    if (mem.rowCount === 0) return res.status(403).send('Not a member');

    const { rows } = await pool.query(
      `SELECT id,
              sender_login   AS sender_nickname,
              text,
              time,
              is_read
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
