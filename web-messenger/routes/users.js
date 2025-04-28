// server/routes/users.js
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware: извлекаем login из JWT
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// GET /api/users — возвращаем всех пользователей (login + nickname)
// кроме текущего
router.get('/', authMiddleware, async (req, res) => {
  try {
    // 1. Берём всех пользователей из users, кроме себя
    const { rows: users } = await pool.query(
      'SELECT id, login FROM users WHERE login <> $1',
      [req.userLogin]
    );

    const result = [];
    // 2. Для каждого пользователя вытягиваем nickname из их таблицы user_<id>
    for (const u of users) {
      const tableName = `user_${u.id}`;
      let nickname = null;

      try {
        const { rows } = await pool.query(
          // в таблице user_<id> должен быть хотя бы один профиль
          `SELECT nickname FROM ${tableName} LIMIT 1`
        );
        if (rows.length > 0) nickname = rows[0].nickname;
      } catch (err) {
        // если таблицы ещё нет или не сохранён профиль — просто пропускаем
        console.error(`Error querying ${tableName}:`, err.message);
      }

      result.push({
        login: u.login,
        nickname: nickname || u.login  // если нет никнейма, покажем login
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).send('Error fetching users');
  }
});

module.exports = router;
