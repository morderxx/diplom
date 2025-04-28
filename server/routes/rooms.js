const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// middleware: проверяем токен, достаём userId и nickname
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');

  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;

    // читаем nickname из users
    const { rows } = await pool.query(
      'SELECT nickname FROM users WHERE id = $1',
      [req.userId]
    );
    req.userNickname = rows[0]?.nickname;
    if (!req.userNickname) {
      return res.status(400).send('Complete your profile first');
    }
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// POST /api/rooms — создать комнату (групповую или приватную)
router.post('/', authMiddleware, async (req, res) => {
  let { name, is_group, members } = req.body;

  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  // Добавляем себя, если забыли
  if (!members.includes(req.userNickname)) {
    members.push(req.userNickname);
  }

  // Для приватного чата: ровно 2 участника → имя = ник второго
  if (!is_group && members.length === 2) {
    name = members.find(n => n !== req.userNickname);
  }

  try {
    // создаём запись в rooms
    const roomRes = await pool.query(
      'INSERT INTO rooms (name, is_group) VALUES ($1,$2) RETURNING id, name',
      [name || null, is_group]
    );
    const roomId = roomRes.rows[0].id;

    // вставляем каждого участника в room_members по nickname
    await Promise.all(
      members.map(nick =>
        pool.query(
          'INSERT INTO room_members (room_id, nickname) VALUES ($1,$2)',
          [roomId, nick]
        )
      )
    );

    res.json({ roomId, name: roomRes.rows[0].name });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).send('Error creating room');
  }
});

// GET /api/rooms — список комнат текущего пользователя
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.is_group, r.created_at
         FROM rooms r
         JOIN room_members m ON m.room_id = r.id
        WHERE m.nickname = $1
     ORDER BY r.created_at DESC`,
      [req.userNickname]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).send('Error fetching rooms');
  }
});

// GET /api/rooms/:roomId/messages — история сообщений в комнате
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // проверяем членство по nickname
    const mem = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND nickname = $2',
      [roomId, req.userNickname]
    );
    if (mem.rowCount === 0) {
      return res.status(403).send('Not a member');
    }

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
