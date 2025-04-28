const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;
    // Получим nickname текущего пользователя
    const prof = await pool.query(
      'SELECT nickname FROM users WHERE login = $1',
      [req.userLogin]
    );
    req.userNickname = prof.rows[0]?.nickname;
    if (!req.userNickname) {
      return res.status(400).send('Complete your profile first');
    }
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// GET /api/rooms — возвращаем комнаты + список участников
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Собираем вместе room и участников
    const { rows } = await pool.query(
      `SELECT 
         r.id, 
         r.name, 
         r.is_group, 
         r.created_at,
         array_agg(m.nickname) AS members
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

// POST /api/rooms — создать новую комнату (групповую или приватную)
router.post('/', authMiddleware, async (req, res) => {
  let { name = null, is_group, members } = req.body;

  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }
  // Всегда добавляем себя
  if (!members.includes(req.userNickname)) {
    members.push(req.userNickname);
  }
  // Для приватного чата с двумя пользователями имя комнаты = ник второго
  if (!is_group && members.length === 2) {
    name = members.find(n => n !== req.userNickname);
  }

  try {
    // 1) Создать комнату
    const roomRes = await pool.query(
      'INSERT INTO rooms (name, is_group) VALUES ($1,$2) RETURNING id, name',
      [name, is_group]
    );
    const roomId = roomRes.rows[0].id;

    // 2) Записать участников
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

// GET /api/rooms/:roomId/messages — история сообщений
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // Проверяем, что мы участник
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
