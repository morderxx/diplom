// routes/users.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

// Берём тот же секрет, что и в auth.js (fallback на 'secret123')
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware для проверки токена и извлечения login + id
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;
    req.userId    = payload.id;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// GET /api/users — список всех зарегистрированных пользователей (login + nickname)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows: users } = await pool.query(
      'SELECT id, login FROM users WHERE login <> $1',
      [req.userLogin]
    );
    const result = [];
    for (const u of users) {
      let nickname = u.login;
      try {
        const tbl = `user_${u.id}`;
        const { rows } = await pool.query(
          `SELECT nickname FROM ${tbl} ORDER BY id DESC LIMIT 1`
        );
        if (rows.length) nickname = rows[0].nickname;
      } catch {
        // таблицы ещё может не быть — игнорируем
      }
      result.push({ login: u.login, nickname });
    }
    res.json(result);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).send('Error fetching users');
  }
});

module.exports = router;
