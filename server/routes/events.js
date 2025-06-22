// server/routes/events.js
const express = require('express');
const pool    = require('../db');
const router  = express.Router();
const jwt     = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Аутентификация по JWT, кладёт в req.userId из payload.id
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    // В вашем auth.js вы подписываете { id, login }
    req.userId = payload.id;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// GET /events
// - ?date=YYYY-MM-DD    — возвращает [{ time, description }, ...] для этой даты
// - ?year=YYYY&month=M  — возвращает ['YYYY-MM-DD', ...] для подсветки календаря
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.userId;

  // 1) Запрос по конкретной дате
  if (req.query.date) {
    const date = req.query.date;
    try {
      const { rows } = await pool.query(`
        SELECT event_time AS time,
               description
        FROM events
        WHERE user_id    = $1
          AND event_date = $2
        ORDER BY event_time NULLS FIRST
      `, [userId, date]);

      return res.json(rows);
    } catch (err) {
      console.error('Error fetching events by date:', err);
      return res.status(500).send('DB error');
    }
  }

    // 1.2) Запрос по диапазону дат
  else if (req.query.start && req.query.end) {
    try {
      const { rows } = await pool.query(`
        SELECT 
          event_date AS date, 
          event_time AS time,
          description
        FROM events
        WHERE user_id = $1
          AND event_date BETWEEN $2 AND $3
      `, [userId, req.query.start, req.query.end]);

      return res.json(rows);
    } catch (err) {
      console.error('Error fetching events by range:', err);
      return res.status(500).send('DB error');
    }
  }
  // 2) Запрос для подсветки календаря
  const year  = parseInt(req.query.year,  10);
  const month = parseInt(req.query.month, 10);
  if (!year || !month) {
    return res.status(400).send('year and month required');
  }

  try {
    const { rows } = await pool.query(`
      SELECT event_date::text AS date
      FROM events
      WHERE user_id = $1
        AND EXTRACT(YEAR  FROM event_date) = $2
        AND EXTRACT(MONTH FROM event_date) = $3
    `, [userId, year, month]);

    return res.json(rows.map(r => r.date));
  } catch (err) {
    console.error('Error fetching event dates:', err);
    return res.status(500).send('DB error');
  }
});

// POST /events
// Body: { date, time, desc }
router.post('/', authMiddleware, async (req, res) => {
  console.log("Received event:", req.body);
  const userId = req.userId;
  const { date, time, desc } = req.body;
  if (!date || !desc) return res.status(400).send('date and desc required');

  try {
    await pool.query(`
      INSERT INTO events(user_id, event_date, event_time, description)
      VALUES ($1, $2, $3, $4)
    `, [userId, date, time || null, desc]);

    res.status(201).send('ok');
  } catch (err) {
    console.error('Error saving event:', err);
    res.status(500).send('DB error');
  }
});

module.exports = router;
