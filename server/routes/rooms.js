// server/routes/rooms.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: верифицируем токен, сохраняем login и nickname
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;
    // Подтягиваем nickname из users
    const userRes = await pool.query(
      'SELECT nickname FROM users WHERE login = $1',
      [req.userLogin]
    );
    req.userNickname = userRes.rows[0]?.nickname || req.userLogin;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// Создание комнаты
router.post('/', authMiddleware, async (req, res) => {
  let { name = null, is_group, members } = req.body;
  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  // Всегда добавляем себя
  if (!members.includes(req.userLogin)) {
    members.push(req.userLogin);
  }

  // Для приватной ещё раз вычисляем display-name = nickname второго
  if (!is_group && members.length === 2) {
    const otherLogin = members.find(l => l !== req.userLogin);
    try {
      const { rows } = await pool.query(
        'SELECT nickname FROM users WHERE login = $1',
        [otherLogin]
      );
      name = rows[0]?.nickname || otherLogin;
    } catch (e) {
      console.error('Error loading other nickname:', e);
      name = otherLogin;
    }
  }

  try {
    // 1) создаём запись о комнате
    const roomRes = await pool.query(
      'INSERT INTO rooms (name, is_group) VALUES ($1,$2) RETURNING id, name',
      [name, is_group]
    );
    const roomId = roomRes.rows[0].id;

    // 2) записываем участников по nickname
    await Promise.all(members.map(async login => {
      // подгружаем их nickname
      const { rows } = await pool.query(
        'SELECT nickname FROM users WHERE login = $1',
        [login]
      );
      const nick = rows[0]?.nickname || login;
      await pool.query(
        'INSERT INTO room_members (room_id, nickname) VALUES ($1, $2)',
        [roomId, nick]
      );
    }));

    res.json({ roomId, name: roomRes.rows[0].name });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).send('Error creating room');
  }
});

// Список комнат пользователя
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

// История сообщений
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // проверяем, что наш nickname есть в room_members
    const mem = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND nickname = $2',
      [roomId, req.userNickname]
    );
    if (mem.rowCount === 0) {
      return res.status(403).send('Not a member');
    }

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
