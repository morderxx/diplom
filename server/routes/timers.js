// server/routes/timers.js
const express = require('express');
const pool    = require('../db');
const router  = express.Router();
const jwt     = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware точно такой же, как в events.js
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

router.use(authMiddleware);

// GET /timers — возвращает все таймеры пользователя, время ≥ сейчас
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, time AT TIME ZONE 'UTC' AS time
       FROM Timers
       WHERE user_id = $1
         AND type = 'timer'
         AND time >= NOW()
       ORDER BY time`,
      [req.userId]
    );
    // вернём [{ id, time: '2025-05-25T12:34:00.000Z' }, …]
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('DB error');
  }
});

// POST /timers — создаём новый таймер
// body: { seconds: Number }
router.post('/', async (req, res) => {
  const userId = req.userId;
  const { seconds } = req.body;
  if (typeof seconds !== 'number' || seconds <= 0) {
    return res.status(400).send('seconds required');
  }
  try {
    // сохраняем момент окончания
    const { rows } = await pool.query(
      `INSERT INTO Timers(user_id, type, time)
       VALUES($1, 'timer', NOW() + ($2 || '0 seconds')::interval)
       RETURNING id, time AT TIME ZONE 'UTC' AS time`,
      [userId, `${seconds} seconds`]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('DB error');
  }
});

module.exports = router;
