const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId    = payload.id;
    req.userLogin = payload.login;
    next();
  } catch {
    res.status(401).send('Invalid token');
  }
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const meR = await pool.query(
      'SELECT nickname FROM users WHERE id = $1',
      [req.userId]
    );
    const myNick = meR.rows[0].nickname;
    const roomsR = await pool.query(
      `SELECT
         r.id,
         r.name,
         r.is_group,
         array_agg(m.nickname) AS members
       FROM rooms r
       JOIN room_members m ON m.room_id = r.id
      WHERE m.nickname = $1
      GROUP BY r.id
      ORDER BY r.created_at DESC`,
      [myNick]
    );
    res.json(roomsR.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching rooms');
  }
});

router.post('/', authMiddleware, async (req, res) => {
  let { name = null, is_group, members } = req.body;
  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }
  const memberIds = [...new Set(
    members.map(m => parseInt(m, 10)).filter(n => !isNaN(n))
  )];
  if (!memberIds.includes(req.userId)) memberIds.push(req.userId);

  if (!is_group && memberIds.length === 2) {
    const otherId = memberIds.find(id => id !== req.userId);
    const otherR  = await pool.query(
      'SELECT nickname FROM users WHERE id = $1',
      [otherId]
    );
    if (otherR.rows[0]) name = otherR.rows[0].nickname;
  }

  try {
    const roomR = await pool.query(
      'INSERT INTO rooms(name,is_group) VALUES($1,$2) RETURNING id',
      [name, is_group]
    );
    const roomId = roomR.rows[0].id;

    await Promise.all(memberIds.map(async id => {
      const nickR = await pool.query(
        'SELECT nickname FROM users WHERE id = $1',
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
    console.error(err);
    res.status(500).send('Error creating room');
  }
});

router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    const chk = await pool.query(
      `SELECT 1 FROM room_members
         WHERE room_id = $1
           AND nickname = (
             SELECT nickname FROM users WHERE id = $2
           )`,
      [roomId, req.userId]
    );
    if (chk.rowCount === 0) return res.status(403).send('Not a member');

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
    console.error(err);
    res.status(500).send('Error fetching messages');
  }
});

module.exports = router;
