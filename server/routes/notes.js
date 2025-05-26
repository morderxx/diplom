const express = require('express');
const pool    = require('../db');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware аутентификации
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch (e) {
    res.status(401).send('Invalid token');
  }
}

// GET /notes — вернуть заметки пользователя
router.get('/', authMiddleware, async (req, res) => {
  const { userId } = req;
  try {
    const { rows } = await pool.query(
      `SELECT content FROM notes WHERE user_id = $1`,
      [userId]
    );
    res.json({ content: rows[0]?.content || '' });
  } catch (e) {
    console.error(e);
    res.status(500).send('DB error');
  }
});

// POST /notes — сохранить заметки пользователя
router.post('/', authMiddleware, async (req, res) => {
  const { userId } = req;
  const { content } = req.body;
  try {
    await pool.query(`
      INSERT INTO notes(user_id, content, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET content = $2, updated_at = NOW()
    `, [userId, content]);
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).send('DB error');
  }
});

module.exports = router;
