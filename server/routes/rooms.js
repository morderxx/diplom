// server/routes/rooms.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// 1) Middleware разбирает JWT и кладёт логин в req.userLogin
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// 2) Создать комнату (приват или группа)
router.post('/', authMiddleware, async (req, res) => {
  let { name = null, is_group, members } = req.body;
  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  // Вставляем себя в members, если ещё нет
  if (!members.includes(req.userLogin)) {
    members.push(req.userLogin);
  }

  // Для приватного чата из двух человек — подставляем display-имя
  if (!is_group && members.length === 2) {
    const otherLogin = members.find(l => l !== req.userLogin);
    // Берём никнейм из users.nickname
    try {
      const { rows } = await pool.query(
        'SELECT nickname FROM users WHERE login = $1',
        [otherLogin]
      );
      name = rows[0]?.nickname || otherLogin;
    } catch {
      name = otherLogin;
    }
  }

  try {
    // 1) Создать комнату
    const roomRes = await pool.query(
      `INSERT INTO rooms(name, is_group)
       VALUES ($1, $2)
       RETURNING id, name`,
      [name, is_group]
    );
    const roomId = roomRes.rows[0].id;

    // 2) Записать участников в room_members.nickname = users.login
    await Promise.all(members.map(login =>
      pool.query(
        `INSERT INTO room_members(room_id, nickname)
         VALUES ($1, $2)`,
        [roomId, login]
      )
    ));

    res.json({ roomId, name: roomRes.rows[0].name });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).send('Error creating room');
  }
});

// 3) Список комнат текущего пользователя
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.is_group, r.created_at
         FROM rooms r
         JOIN room_members m ON m.room_id = r.id
        WHERE m.nickname = $1
     ORDER BY r.created_at DESC`,
      [req.userLogin]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).send('Error fetching rooms');
  }
});

// 4) История сообщений для комнаты
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // Проверяем членство
    const { rowCount } = await pool.query(
      `SELECT 1 FROM room_members
        WHERE room_id = $1 AND nickname = $2`,
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
    console.error('Error fetching messages:', err);
    res.status(500).send('Error fetching messages');
  }
});

module.exports = router;
