// server/routes/rooms.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: проверяет JWT, сохраняет req.userLogin и req.userId
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;
    req.userId    = payload.id;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// POST /api/rooms — создать приватную или групповую комнату
router.post('/', authMiddleware, async (req, res) => {
  let { name = null, is_group, members } = req.body;

  // Проверяем список участников
  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  // Приводим ID к числам и убираем дубликаты
  members = members.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

  // Всегда добавляем себя
  if (!members.includes(req.userId)) {
    members.push(req.userId);
  }

  // Если приватный чат из двух человек — формируем display-name
  if (!is_group && members.length === 2) {
    const otherId = members.find(id => id !== req.userId);
    if (otherId) {
      try {
        const { rows } = await pool.query(
          'SELECT nickname FROM users WHERE id = $1',
          [otherId]
        );
        if (rows[0] && rows[0].nickname) {
          name = rows[0].nickname;
        }
      } catch (err) {
        console.warn('Could not fetch other user nickname:', err);
      }
    }
  }

  try {
    // Создаем комнату
    const roomRes = await pool.query(
      `INSERT INTO rooms(name, is_group)
         VALUES($1, $2)
         RETURNING id`,
      [name, is_group]
    );
    const roomId = roomRes.rows[0].id;

    // Вставляем участников
    await Promise.all(
      members.map(async userId => {
        const nickRes = await pool.query(
          'SELECT nickname FROM users WHERE id = $1',
          [userId]
        );
        const nick = nickRes.rows[0]?.nickname;
        if (nick) {
          await pool.query(
            `INSERT INTO room_members(room_id, nickname)
             VALUES($1, $2)` ,
            [roomId, nick]
          );
        }
      })
    );

    res.json({ roomId, name });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).send('Error creating room');
  }
});

// GET /api/rooms — список комнат текущего пользователя
router.get('/', authMiddleware, async (req, res) => {
  try {
    const meRes = await pool.query(
      'SELECT nickname FROM users WHERE id = $1',
      [req.userId]
    );
    const myNick = meRes.rows[0]?.nickname;
    if (!myNick) return res.status(500).send('Your nickname missing');

    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.is_group, r.created_at
         FROM rooms r
         JOIN room_members m ON m.room_id = r.id
        WHERE m.nickname = $1
     ORDER BY r.created_at DESC`,
      [myNick]
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
    // Проверяем членство
    const check = await pool.query(
      `SELECT 1 FROM room_members WHERE room_id = $1 AND nickname = (
         SELECT nickname FROM users WHERE id = $2
       )`,
      [roomId, req.userId]
    );
    if (check.rowCount === 0) {
      return res.status(403).send('Not a member of this room');
    }

    const { rows } = await pool.query(
      `SELECT sender, text, time, is_read
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
