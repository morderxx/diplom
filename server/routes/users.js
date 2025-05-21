// server/routes/users.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: проверяет JWT, кладёт в req.userLogin и req.userId
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

// GET /api/users — список всех пользователей кроме себя
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Берём всех кроме текущего по login
    const { rows } = await pool.query(
      `SELECT u.id,
              u.nickname,
              u.full_name,
              u.age,
              u.bio
         FROM users u
         JOIN secret_profile sp ON sp.id = u.id
        WHERE sp.login <> $1
     ORDER BY u.nickname`,
      [req.userLogin]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).send('Error fetching users');
  }
});

module.exports = router;
