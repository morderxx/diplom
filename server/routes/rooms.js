const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

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

// POST /api/rooms — создать комнату
router.post('/', authMiddleware, async (req, res) => {
  let { name = null, is_group, members } = req.body;
  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }
  // Приводим и фильтруем ID
  const memberIds = [...new Set(
    members.map(m => parseInt(m, 10)).filter(id => !isNaN(id))
  )];
  // Добавляем себя
  if (!memberIds.includes(req.userId)) memberIds.push(req.userId);

  // Для приватного чата имя = никнейм собеседника
  if (!is_group && memberIds.length === 2) {
    const otherId = memberIds.find(id => id !== req.userId);
    const other   = await pool.query(
      'SELECT nickname FROM users WHERE id = $1',
      [otherId]
    );
    if (other.rows[0]) name = other.rows[0].nickname;
  }

  try {
    const roomRes = await pool.query(
      'INSERT INTO rooms(name, is_group) VALUES($1,$2) RETURNING id',
      [name, is_group]
    );
    const roomId = roomRes.rows[0].id;

    // Вставляем участников в room_members
    await Promise.all(memberIds.map(async id => {
      const nickRes = await pool.query(
        'SELECT nickname FROM users WHERE id = $1',
        [id]
      );
      const nick = nickRes.rows[0]?.nickname;
      if (nick) {
        await pool.query(
          'INSERT INTO room_members(room_id, nickname, joined_at) VALUES($1,$2,NOW())',
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

// GET /api/rooms/:roomId/messages — загрузка сообщений
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // Проверяем, что пользователь в комнате
    const check = await pool.query(
      `SELECT 1
         FROM room_members
        WHERE room_id = $1
          AND nickname = (
            SELECT nickname FROM users WHERE id = $2
          )`,
      [roomId, req.userId]
    );
    if (check.rowCount === 0) return res.status(403).send('Not a member');

    // Достаём сообщения
    const msgs = await pool.query(
      `SELECT sender_nickname AS sender, text, time, is_read
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
