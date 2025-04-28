// server/routes/rooms.js
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token = auth.split(' ')[1];
    const { login } = jwt.verify(token, JWT_SECRET);
    req.userLogin = login;
    next();
  } catch {
    res.status(401).send('Invalid token');
  }
}

// Создать комнату (is_group + members: [login...])
router.post('/', authMiddleware, async (req, res) => {
  const { name, is_group, members } = req.body;
  if (!Array.isArray(members) || members.length < 1)
    return res.status(400).send('Members list required');
  try {
    const { rows } = await pool.query(
      'INSERT INTO rooms (name, is_group) VALUES ($1,$2) RETURNING id',
      [name || null, is_group]
    );
    const roomId = rows[0].id;
    await Promise.all(members.map(login =>
      pool.query(
        'INSERT INTO room_members (room_id,user_login) VALUES($1,$2)',
        [roomId, login]
      )
    ));
    res.json({ roomId });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating room');
  }
});

// Список комнат текущего пользователя
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.is_group, r.created_at
         FROM rooms r
         JOIN room_members m ON m.room_id = r.id
        WHERE m.user_login = $1
     ORDER BY r.created_at DESC`,
      [req.userLogin]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching rooms');
  }
});

// История сообщений в комнате
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // Проверяем членство
    const { rowCount } = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id=$1 AND user_login=$2',
      [roomId, req.userLogin]
    );
    if (rowCount === 0) return res.status(403).send('Not a member');

    const { rows } = await pool.query(
      `SELECT id, sender_login, text, time, is_read
         FROM messages
        WHERE room_id = $1
     ORDER BY time`,
      [roomId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching messages');
  }
});

module.exports = router;
