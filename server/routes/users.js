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

// Поиск пользователей и каналов
router.get('/search', authMiddleware, async (req, res) => {
  const { q, type } = req.query;
  
  try {
    if (type === 'user') {
      const { rows: users } = await pool.query(
        `SELECT u.nickname 
         FROM users u
         JOIN secret_profile sp ON sp.id = u.id
         WHERE u.nickname ILIKE $1 AND sp.login <> $2 LIMIT 10`,
        [`%${q}%`, req.userLogin]
      );
      res.json(users);
    } else if (type === 'channel') {
      const { rows: channels } = await pool.query(
        `SELECT id, name FROM rooms 
         WHERE (is_group = true OR is_channel = true) 
         AND name ILIKE $1 LIMIT 10`,
        [`%${q}%`]
      );
      res.json(channels);
    } else {
      res.status(400).json({ error: 'Invalid search type' });
    }
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
