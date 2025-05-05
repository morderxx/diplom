// server/routes/rooms.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// JWT-middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId    = payload.id;
    req.userLogin = payload.login;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// GET /api/rooms — список комнат пользователя
router.get('/', authMiddleware, async (req, res) => {
  try {
    const me = await pool.query(
      'SELECT nickname FROM users WHERE id=$1',
      [req.userId]
    );
    const myNick = me.rows[0]?.nickname;
    if (!myNick) return res.status(400).send('Profile missing');

    const rooms = await pool.query(
      `SELECT r.id, r.name, r.is_group, r.created_at
         FROM rooms r
         JOIN room_members m ON m.room_id = r.id
        WHERE m.nickname = $1
     ORDER BY r.created_at DESC`,
      [myNick]
    );
    res.json(rooms.rows);
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).send('Error fetching rooms');
  }
});

// POST /api/rooms — создать комнату
router.post('/', authMiddleware, async (req, res) => {
  let { name = null, is_group, members } = req.body;
  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  // чистка ID
  const memberIds = [...new Set(
    members
      .map(m => parseInt(m, 10))
      .filter(id => !isNaN(id))
  )];
  if (!memberIds.includes(req.userId)) memberIds.push(req.userId);

  // приватный чат — имя второго
  if (!is_group && memberIds.length === 2) {
    const otherId = memberIds.find(id => id !== req.userId);
    const other   = await pool.query(
      'SELECT nickname FROM users WHERE id=$1',
      [otherId]
    );
    if (other.rows[0]) name = other.rows[0].nickname;
  }

  try {
    const roomRes = await pool.query(
      'INSERT INTO rooms(name,is_group) VALUES($1,$2) RETURNING id',
      [name, is_group]
    );
    const roomId = roomRes.rows[0].id;

    // вставляем участников
    await Promise.all(memberIds.map(async id => {
      const nickRes = await pool.query(
        'SELECT nickname FROM users WHERE id=$1',
        [id]
      );
      const nick = nickRes.rows[0]?.nickname;
      if (nick) {
        await pool.query(
          'INSERT INTO room_members(room_id,nickname,joined_at) VALUES($1,$2,NOW())',
          [roomId, nick]
        );
      }
    }));

    res.json({ roomId, name });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).send('Error creating room');
  }
});

// GET /api/rooms/:roomId/messages — история + файлы
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // проверяем членство
    const chk = await pool.query(
      `SELECT 1 FROM room_members
        WHERE room_id = $1
          AND nickname = (
            SELECT nickname FROM users WHERE id=$2
          )`,
      [roomId, req.userId]
    );
    if (chk.rowCount === 0) return res.status(403).send('Not a member');

    // достаём и текст, и file_id, и filename
    const msgs = await pool.query(
      `SELECT
         sender_nickname AS sender,
         text,
         file_id,
         (SELECT filename FROM files WHERE id = messages.file_id) AS filename,
         time,
         is_read
       FROM messages
      WHERE room_id = $1
      ORDER BY time`,
      [roomId]
    );
    res.json(msgs.rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).send('Error fetching messages');
  }
});

module.exports = router;
