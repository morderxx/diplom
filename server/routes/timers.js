// server/routes/timers.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');         // ваш pg-клиент или ORM
const webpush = require('web-push');

// 1) Создание таймера
router.post('/', async (req, res) => {
  const userId = req.user.id;             // из middleware аутентификации
  const { endTime } = req.body;           // ISO-строка или миллисекунды
  try {
    const { rows } = await db.query(
      `INSERT INTO Timers(user_id, type, time) 
       VALUES($1, 'timer', $2) RETURNING *`,
      [userId, endTime]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).send(err.message); }
});

// 2) Получение всех будущих таймеров
router.get('/', async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await db.query(
      `SELECT * FROM Timers
       WHERE user_id=$1 AND type='timer' AND time >= NOW()`,
      [userId]
    );
    res.json(rows);
  } catch (err) { res.status(500).send(err.message); }
});

module.exports = router;
