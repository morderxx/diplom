// server/routes/rooms.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// middleware: из JWT достаём login и nickname
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;
    // подтягиваем nickname
    const prof = await pool.query(
      `SELECT u.nickname
         FROM users u
         JOIN secret_profile s ON s.id = u.id
        WHERE s.login = $1`,
      [req.userLogin]
    );
    if (prof.rows.length === 0) {
      return res.status(400).send('Complete your profile first');
    }
    req.userNickname = prof.rows[0].nickname;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// 1) GET /api/rooms — список своих комнат с массивом участников
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         r.id,
         r.name,
         r.is_group,
         r.created_at,
         array_agg(m.nickname ORDER BY m.nickname) AS members
       FROM rooms r
       JOIN room_members m ON m.room_id = r.id
      WHERE m.nickname = $1
      GROUP BY r.id
      ORDER BY r.created_at DESC`,
      [req.userNickname]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).send('Error fetching rooms');
  }
});

// 2) POST /api/rooms — создать или вернуть приватную/групповую комнату
router.post('/', authMiddleware, async (req, res) => {
  let { is_group, members } = req.body;
  let name = req.body.name || null;

  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  // всегда добавляем себя
  if (!members.includes(req.userNickname)) {
    members.push(req.userNickname);
  }

  // приватный чат: ровно 2 участника
  if (!is_group && members.length === 2) {
    const [a, b] = members.sort();
    // ищем готовую комнату между a и b
    const exist = await pool.query(
      `SELECT r.id
         FROM rooms r
         JOIN room_members m1 ON m1.room_id = r.id
         JOIN room_members m2 ON m2.room_id = r.id
        WHERE r.is_group = FALSE
          AND m1.nickname = $1
          AND m2.nickname = $2`,
      [a, b]
    );
    if (exist.rows.length) {
      const roomId = exist.rows[0].id;
      // имя приватки = ник второго участника
      const other = members.find(n => n !== req.userNickname);
      return res.json({ roomId, name: other });
    }
    // при создании новой → имя второго
    name = members.find(n => n !== req.userNickname);
  }

  try {
    const roomRes = await pool.query(
      'INSERT INTO rooms (name, is_group) VALUES ($1,$2) RETURNING id, name',
      [name, is_group]
    );
    const roomId = roomRes.rows[0].id;

    // вставляем всех участников
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

// 3) GET /api/rooms/:roomId/messages — история сообщений
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // проверяем, что пользователь — участник комнаты
    const mem = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND nickname = $2',
      [roomId, req.userNickname]
    );
    if (mem.rowCount === 0) {
      return res.status(403).send('Not a member');
    }

    // возвращаем историю
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
