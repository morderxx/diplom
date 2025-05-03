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

  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  // Всегда добавляем себя по userId
  if (!members.includes(req.userId)) {
    members.push(req.userId);
  }

  // Если приватный чат из двух человек — формируем display-name
  if (!is_group && members.length === 2) {
    const otherId = members.find(id => id !== req.userId);
    try {
      const { rows } = await pool.query(
        'SELECT nickname FROM users WHERE id = $1',
        [otherId]
      );
      name = rows[0]?.nickname || name;
    } catch {
      // оставляем name null, сервер подставит fallback
    }
  }

  try {
    // 1) Создаём запись в rooms
    const roomRes = await pool.query(
      `INSERT INTO rooms(name, is_group)
       VALUES($1,$2)
       RETURNING id, name`,
      [name, is_group]
    );
    const roomId = roomRes.rows[0].id;

    // 2) Вставляем участников в room_members по nickname из users
    await Promise.all(
      members.map(async userId => {
        const nickRes = await pool.query(
          'SELECT nickname FROM users WHERE id = $1',
          [userId]
        );
        const nick = nickRes.rows[0]?.nickname;
        if (!nick) throw new Error(`No nickname for user ${userId}`);
        await pool.query(
          `INSERT INTO room_members(room_id, nickname)
           VALUES($1,$2)`,
          [roomId, nick]
        );
      })
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
    // Сначала получаем свой ник
    const meRes = await pool.query(
      'SELECT nickname FROM users WHERE id = $1',
      [req.userId]
    );
    const myNick = meRes.rows[0]?.nickname;
    if (!myNick) return res.status(500).send('Your nickname missing');

    // Затем выбираем комнаты, где он есть
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
    // Проверяем, что текущий участник в room_members
    const meRes = await pool.query(
      'SELECT nickname FROM users WHERE id = $1',
      [req.userId]
    );
    const myNick = meRes.rows[0]?.nickname;
    if (!myNick) return res.status(500).send('Your nickname missing');

    const memRes = await pool.query(
      `SELECT 1 FROM room_members
        WHERE room_id = $1 AND nickname = $2`,
      [roomId, myNick]
    );
    if (memRes.rowCount === 0) {
      return res.status(403).send('Not a member');
    }

    const { rows } = await pool.query(
      `SELECT id,
              sender_nickname AS sender,
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
