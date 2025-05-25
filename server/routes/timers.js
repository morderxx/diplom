const express = require('express');
const pool    = require('../db');
const router  = express.Router();
const jwt     = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

async function authMiddleware(req, res, next) {
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

router.use(authMiddleware);

// GET /timers
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id,
             type,
             "time" AT TIME ZONE 'UTC' AS time
      FROM Timers
      WHERE user_id = $1
        AND "time" >= NOW()
      ORDER BY "time"
    `, [req.userId]);
    res.json(rows.map(r => ({ id: r.id, type: r.type, time: r.time.toISOString() })));
  } catch (err) {
    console.error(err);
    res.status(500).send('DB error');
  }
});

// POST /timers
router.post('/', async (req, res) => {
  const { type, time } = req.body;
  if (!type || !time) return res.status(400).send('type and time required');
  if (!['alarm','timer'].includes(type)) return res.status(400).send('invalid type');

  try {
    await pool.query(`
      INSERT INTO Timers(user_id, type, "time")
      VALUES ($1, $2, $3)
    `, [req.userId, type, time]);
    res.status(201).send('ok');
  } catch (err) {
    console.error(err);
    res.status(500).send('DB error');
  }
});

// DELETE /timers/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM Timers
      WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.userId]);
    if (result.rowCount === 0) return res.status(404).send('Not found');
    res.send('deleted');
  } catch (err) {
    console.error(err);
    res.status(500).send('DB error');
  }
});

module.exports = router;
