// server/routes/users.js
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware для проверки JWT и извлечения login + id
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;
    req.userId = payload.id;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// GET /api/users — список всех пользователей кроме себя
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Берём всех из users
    const { rows: users } = await pool.query(
      'SELECT id, login FROM users WHERE login <> $1',
      [req.userLogin]
    );
    const result = [];
    // Для каждого подтягиваем nickname из таблицы user_{id}
    for (const u of users) {
      let nickname = u.login;
      try {
        const tbl = `user_${u.id}`;
        const { rows } = await pool.query(
          `SELECT nickname FROM ${tbl} ORDER BY id DESC LIMIT 1`
        );
        if (rows.length) nickname = rows[0].nickname;
      } catch {
        // таблицы ещё нет или пустая — игнорируем
      }
      result.push({ login: u.login, nickname });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching users');
  }
});

module.exports = router;
