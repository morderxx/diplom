// server/routes/rooms.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: проверяем JWT и вытаскиваем login + nickname текущего пользователя
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;

    // получаем nickname из users по login через secret_profile → users.id
    const prof = await pool.query(
      `SELECT u.nickname
         FROM users u
         JOIN secret_profile s ON s.id = u.id
        WHERE s.login = $1`,
      [req.userLogin]
    );
    if (!prof.rows.length) return res.status(400).send('Complete your profile first');
    req.userNickname = prof.rows[0].nickname;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// GET /api/rooms — список комнат с массивом участников
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

// POST /api/rooms — создать или вернуть приватную/групповую комнату
router.post('/', authMiddleware, async (req, res) => {
  let { is_group, members } = req.body;
  let name = req.body.name || null;

  if (!Array.isArray(members) || members.length < 1) {
    return res.status(400).send('Members list required');
  }

  // всегда добавляем себя
  if (!members.includes(req.userNickname)) {
    members.push(req.userNickname);
  }

  // приватный чат — ровно 2 участников
  if (!is_group && members.length === 2) {
    // сортируем, чтобы порядок не влиял на поиск
    const sorted = [...members].sort();
    try {
      // ищем существующий чат с этими двумя никнеймами
      const exist = await pool.query(
        `SELECT r.id
           FROM rooms r
           JOIN room_members m ON m.room_id = r.id
          WHERE r.is_group = FALSE
            AND m.nickname = $1
        INTERSECT
         SELECT r2.id
           FROM rooms r2
           JOIN room_members m2 ON m2.room_id = r2.id
          WHERE r2.is_group = FALSE
            AND m2.nickname = $2`,
        sorted
      );
      if (exist.rows.length) {
        const roomId = exist.rows[0].id;
        // имя комнаты для приватки — nickname второго пользователя
        const other = members.find(n => n !== req.userNickname);
        return res.json({ roomId, name: other });
      }
    } catch (e) {
      console.error('Error checking existing private room:', e);
      // fall through to creation
    }

    // если не нашли — имя комнаты = ник второго
    name = members.find(n => n !== req.userNickname);
  }

  try {
    // создаём комнату
    const insert = await pool.query(
      'INSERT INTO rooms (name, is_group) VALUES ($1,$2) RETURNING id, name',
      [name, is_group]
    );
    const roomId = insert.rows[0].id;

    // сохраняем участников
    await Promise.all(
      members.map(nick =>
        pool.query(
          'INSERT INTO room_members (room_id, nickname) VALUES ($1,$2)',
          [roomId, nick]
        )
      )
    );

    res.json({ roomId, name: insert.rows[0].name });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).send('Error creating room');
  }
});

module.exports = router;
