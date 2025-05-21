const express = require('express');
const pool    = require('../db');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).send('No token');
  try {
    req.user = jwt.verify(h.split(' ')[1], JWT_SECRET).login;
    next();
  } catch {
    res.status(401).send('Invalid token');
  }
}

// POST /api/games/snake/score
router.post('/snake/score', auth, async (req, res) => {
  const { score } = req.body;
  try {
    await pool.query(
      `INSERT INTO snake_scores (user_nickname, score) VALUES ($1,$2)`,
      [req.user, score]
    );
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// GET /api/games/snake/leaderboard
router.get('/snake/leaderboard', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT user_nickname, score, time
       FROM snake_scores
       ORDER BY score DESC, time ASC
       LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

module.exports = router;
