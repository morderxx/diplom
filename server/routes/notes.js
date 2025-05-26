/* server/routes/notes.js */
const express = require('express');
const pool    = require('../db');
const router  = express.Router();
const jwt     = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware to authenticate and attach userId
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// GET /notes
// returns { content: string } for this user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT content FROM notes WHERE user_id = $1`,
      [req.userId]
    );
    if (rows.length === 0) {
      return res.json({ content: '' });
    }
    res.json({ content: rows[0].content });
  } catch (err) {
    console.error('Error fetching notes:', err);
    res.status(500).send('DB error');
  }
});

// POST /notes
// body: { content }
router.post('/', authMiddleware, async (req, res) => {
  const { content } = req.body;
  if (typeof content !== 'string') {
    return res.status(400).send('Invalid content');
  }
  try {
    // upsert
    await pool.query(
      `INSERT INTO notes(user_id, content)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET content = EXCLUDED.content`,
      [req.userId, content]
    );
    res.status(200).send('ok');
  } catch (err) {
    console.error('Error saving notes:', err);
    res.status(500).send('DB error');
  }
});

module.exports = router;
