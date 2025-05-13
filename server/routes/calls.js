const express = require('express');
const pool    = require('../db');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware из токена достаём login (можно и nickname подтягивать)
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;
    next();
  } catch (err) {
    res.status(401).send('Invalid token');
  }
}

// POST /api/rooms/:roomId/calls
router.post('/:roomId/calls', authMiddleware, async (req, res) => {
  const roomId    = +req.params.roomId;
  const {
    initiator,
    recipient,
    started_at,
    ended_at,
    status,
    duration
  } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO calls
         (room_id, initiator, recipient, started_at, ended_at, status, duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [roomId, initiator, recipient, started_at, ended_at, status, duration]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error saving call:', err);
    res.status(500).send('Error saving call');
  }
});

// GET /api/rooms/:roomId/calls — если нужно отдельно
router.get('/:roomId/calls', authMiddleware, async (req, res) => {
  const roomId = +req.params.roomId;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM calls
         WHERE room_id = $1
      ORDER BY started_at`,
      [roomId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching calls:', err);
    res.status(500).send('Error fetching calls');
  }
});

module.exports = router;
