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

// 1) GET /api/rooms — список своих комнат + участников
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         r.id,
         r.name,
         r.is_group,
         r.is_channel,
         r.creator_nickname,
         r.created_at,
         array_agg(m.nickname ORDER BY m.nickname) AS members
       FROM rooms r
       JOIN room_members m1
         ON m1.room_id = r.id AND m1.nickname = $1
       JOIN room_members m
         ON m.room_id = r.id
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

// 2) POST /api/rooms — создать или вернуть чат/группу/канал
router.post('/', authMiddleware, async (req, res) => {
  let { is_group, is_channel = false, members } = req.body;
  let name = req.body.name || null;

  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  // добавляем себя, если забыли
  if (!members.includes(req.userNickname)) {
    members.push(req.userNickname);
  }

  // приватный чат: ровно 2 участника и НЕ канал
  if (!is_group && !is_channel && members.length === 2) {
    const [a, b] = members.sort();
    const exist = await pool.query(
      `SELECT r.id
         FROM rooms r
         JOIN room_members m1 ON m1.room_id = r.id
         JOIN room_members m2 ON m2.room_id = r.id
        WHERE r.is_group = FALSE
          AND r.is_channel = FALSE
          AND m1.nickname = $1
          AND m2.nickname = $2`,
      [a, b]
    );
    if (exist.rows.length) {
      const roomId = exist.rows[0].id;
      const other = members.find(n => n !== req.userNickname);
      return res.json({ roomId, name: other });
    }
    // только для приватного чата — имя собеседника
    name = members.find(n => n !== req.userNickname);
  }

  try {
    // создаём комнату/группу/канал
    const roomRes = await pool.query(
      `INSERT INTO rooms
         (name, is_group, is_channel, creator_nickname)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, is_channel, creator_nickname`,
      [name, is_group, is_channel, req.userNickname]
    );
    const roomId = roomRes.rows[0].id;

    // добавляем участников
    await Promise.all(
      members.map(nick =>
        pool.query(
          'INSERT INTO room_members (room_id, nickname) VALUES ($1,$2)',
          [roomId, nick]
        )
      )
    );

    // возвращаем клиенту
    res.json({
      roomId,
      name:       roomRes.rows[0].name,
      is_channel: roomRes.rows[0].is_channel,
      creator:    roomRes.rows[0].creator_nickname
    });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).send('Error creating room');
  }
});

// 3) GET /api/rooms/:roomId/messages — история
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    const mem = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND nickname = $2',
      [roomId, req.userNickname]
    );
    if (mem.rowCount === 0) {
      return res.status(403).send('Not a member');
    }

    const { rows } = await pool.query(
      `SELECT
         m.sender_nickname,
         m.text,
         m.time,
         f.id         AS file_id,
         f.filename,
         f.mime_type  AS mime_type
       FROM messages m
       LEFT JOIN files f
         ON f.id = m.file_id
      WHERE m.room_id = $1
      ORDER BY m.time`,
      [roomId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).send('Error fetching messages');
  }
});

// POST /api/rooms/:roomId/members — добавить участников в группу или канал
// Изменяем POST /api/rooms/:roomId/members
router.post(
  '/:roomId/members',
  authMiddleware,
  async (req, res) => {
    const { roomId } = req.params;
    const { members } = req.body;

    // 1) Проверяем, что комната существует
    const room = await pool.query(
      `SELECT is_group, is_channel, creator_nickname
       FROM rooms
       WHERE id = $1`,
      [roomId]
    );

    if (!room.rows.length) {
      return res.status(404).send('Room not found');
    }

    const roomData = room.rows[0];
    
    // 2) Разрешаем self-join для каналов
    const isSelfJoin = members.length === 1 && members[0] === req.userNickname;
    
    if (roomData.is_channel && isSelfJoin) {
      // Пропускаем проверку членства для self-join
    } else {
      // Для всех остальных случаев проверяем членство
      if (!roomData.is_group && !roomData.is_channel) {
        return res.status(400).send('Cannot add members to a private chat');
      }

      const isMember = await pool.query(
        `SELECT 1 FROM room_members WHERE room_id = $1 AND nickname = $2`,
        [roomId, req.userNickname]
      );
      if (!isMember.rowCount) {
        return res.status(403).send('Not a member');
      }
    }

    // 3) Добавляем участников
    const ins = members.map(nick =>
      pool.query(
        `INSERT INTO room_members (room_id, nickname)
         SELECT $1, $2
         WHERE NOT EXISTS(
           SELECT 1 FROM room_members WHERE room_id = $1 AND nickname = $2
         )`,
        [roomId, nick]
      )
    );
    
    await Promise.all(ins);
    res.json({ ok: true });
  }
);

// В rooms.js добавим
// GET /api/rooms/:roomId - get room details
router.get('/:roomId', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT 
         r.id,
         r.name,
         r.is_group,
         r.is_channel,
         r.creator_nickname,
         array_agg(m.nickname) AS members
       FROM rooms r
       JOIN room_members m ON m.room_id = r.id
      WHERE r.id = $1
      GROUP BY r.id`,
      [roomId]
    );
    
    if (rows.length === 0) {
      return res.status(404).send('Room not found');
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching room:', err);
    res.status(500).send('Error fetching room');
  }
});

// DELETE /api/rooms/:roomId - удалить комнату (только для приватных чатов)
router.delete('/:roomId', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // Проверяем, что это приватный чат и текущий пользователь участник
    const room = await pool.query(
      `SELECT is_group, is_channel 
       FROM rooms 
       WHERE id = $1`,
      [roomId]
    );
    
    if (room.rows.length === 0) {
      return res.status(404).send('Room not found');
    }
    
    if (room.rows[0].is_group || room.rows[0].is_channel) {
      return res.status(400).send('Can only delete private chats');
    }
    
    // Удаляем комнату
    await pool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting room:', err);
    res.status(500).send('Error deleting room');
  }
});

// DELETE /api/rooms/:roomId/messages - очистить историю
router.delete('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // Проверяем членство
    const isMember = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND nickname = $2',
      [roomId, req.userNickname]
    );
    if (!isMember.rowCount) {
      return res.status(403).send('Not a member');
    }
    
    // Удаляем сообщения
    await pool.query('DELETE FROM messages WHERE room_id = $1', [roomId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error clearing messages:', err);
    res.status(500).send('Error clearing messages');
  }
});

// DELETE /api/rooms/:roomId/members/:nickname - покинуть комнату
router.delete('/:roomId/members/:nickname', authMiddleware, async (req, res) => {
  const { roomId, nickname } = req.params;
  
  if (nickname !== req.userNickname) {
    return res.status(403).send('Can only leave yourself');
  }
  
  try {
    // Проверяем, что пользователь участник
    const isMember = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND nickname = $2',
      [roomId, nickname]
    );
    if (!isMember.rowCount) {
      return res.status(400).send('Not a member');
    }
    
    // Проверяем тип комнаты
    const room = await pool.query(
      'SELECT is_group, is_channel FROM rooms WHERE id = $1',
      [roomId]
    );
    
    if (!room.rows[0].is_group && !room.rows[0].is_channel) {
      return res.status(400).send('Cannot leave private chat');
    }
    
    // Удаляем из участников
    await pool.query(
      'DELETE FROM room_members WHERE room_id = $1 AND nickname = $2',
      [roomId, nickname]
    );
    
    res.json({ ok: true });
  } catch (err) {
    console.error('Error leaving room:', err);
    res.status(500).send('Error leaving room');
  }
});
module.exports = router;
