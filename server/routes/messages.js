const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: из JWT достаём login и nickname
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;

    const prof = await pool.query(
      `SELECT u.nickname
         FROM users u
         JOIN secret_profile s ON s.id = u.id
        WHERE s.login = $1`,
      [req.userLogin]
    );
    if (prof.rows.length === 0) {
      return res.status(400).send('Complete your profile first');
    }
    req.userNickname = prof.rows[0].nickname;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// GET /api/rooms/:roomId/messages — история сообщений и звонков
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    const mem = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND nickname = $2',
      [roomId, req.userNickname]
    );
    if (mem.rowCount === 0) {
      return res.status(403).send('Not a member');
    }

    // Получаем из сообщений все записи: тексты, файлы и системные уведомления о звонках
    const { rows } = await pool.query(
      `
      SELECT
        CASE
          WHEN m.call_id IS NOT NULL THEN 'call'
          WHEN m.file_id IS NOT NULL THEN 'file'
          ELSE 'message'
        END AS type,
        m.sender_nickname,
        m.text,
        m.time,
        m.file_id,
        m.filename,
        m.mime_type,
        c.recipient,
        c.status,
        c.duration,
        c.ended_at
      FROM messages m
      LEFT JOIN calls c ON m.call_id = c.id
      WHERE m.room_id = $1
      ORDER BY m.time;
      `,
      [roomId]
    );

    console.log(`Fetched ${rows.length} items for room ${roomId}:`, rows);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).send('Error fetching messages');
  }
});

module.exports = router;
