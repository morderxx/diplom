// server/routes/rooms.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: проверяем JWT и сохраняем req.userId / req.userLogin
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

// 1) GET /api/rooms — список комнат текущего пользователя
router.get('/', authMiddleware, async (req, res) => {
  try {
    // получаем никнейм текущего
    const me = await pool.query(
      'SELECT nickname FROM users WHERE id=$1',
      [req.userId]
    );
    const myNick = me.rows[0]?.nickname;
    if (!myNick) return res.status(400).send('No nickname');

    // все комнаты, где он есть
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

// 2) POST /api/rooms — создать новую комнату (приватную или группу)
router.post('/', authMiddleware, async (req, res) => {
  let { name = null, is_group, members } = req.body;

  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  // Приводим к числам, убираем NaN, убираем дубли
  const memberIds = [...new Set(
    members.map(m => parseInt(m, 10)).filter(id => !isNaN(id))
  )];

  // Всегда добавляем себя
  if (!memberIds.includes(req.userId)) {
    memberIds.push(req.userId);
  }

  // Для приватного чата — имя по никнейму собеседника
  if (!is_group && memberIds.length === 2) {
    const otherId = memberIds.find(id => id !== req.userId);
    const other   = await pool.query(
      'SELECT nickname FROM users WHERE id=$1',
      [otherId]
    );
    if (other.rows[0]) {
      name = other.rows[0].nickname;
    }
  }

  try {
    // Создаём комнату
    const roomRes = await pool.query(
      'INSERT INTO rooms(name,is_group) VALUES($1,$2) RETURNING id',
      [name, is_group]
    );
    const roomId = roomRes.rows[0].id;

    // Вставляем участников
    await Promise.all(memberIds.map(async id => {
      const nickR = await pool.query(
        'SELECT nickname FROM users WHERE id=$1',
        [id]
      );
      const nick = nickR.rows[0]?.nickname;
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

// 3) GET /api/rooms/:roomId/messages — история сообщений
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;

  try {
    // Проверяем, что текущий пользователь в комнате
    const check = await pool.query(
      `SELECT 1 FROM room_members
        WHERE room_id=$1
          AND nickname = (
            SELECT nickname FROM users WHERE id=$2
         )`,
      [roomId, req.userId]
    );
    if (check.rowCount === 0) {
      return res.status(403).send('Not a member');
    }

    // Запрашиваем сообщения
    const msgs = await pool.query(
      `SELECT sender_nickname AS sender,
              text,
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
