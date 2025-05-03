const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: из JWT достаём login и nickname
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;

    // Берём nickname через join secret_profile→users
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

// GET /api/rooms — список комнат + массив участников
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

// POST /api/rooms — создать или вернуть приватку/группу
router.post('/', authMiddleware, async (req, res) => {
  let { is_group, members } = req.body;
  let name = req.body.name || null;

  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  // Вставляем себя, если забыли
  if (!members.includes(req.userNickname)) {
    members.push(req.userNickname);
  }

  // Приватный чат: ровно 2 человека
  if (!is_group && members.length === 2) {
    const [a, b] = members.sort();
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
      // имя приватки = ник второго
      const other = members.find(n => n !== req.userNickname);
      return res.json({ roomId, name: other });
    }
    // при создании берем ник второго как имя
    name = members.find(n => n !== req.userNickname);
  }

  try {
    const roomRes = await pool.query(
      'INSERT INTO rooms (name, is_group) VALUES ($1,$2) RETURNING id, name',
      [name, is_group]
    );
    const roomId = roomRes.rows[0].id;

    // вставляем участников
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

module.exports = router;
