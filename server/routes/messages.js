const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// middleware: проверяем токен, достаём userId и nickname
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');

  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;

    const { rows } = await pool.query(
      'SELECT nickname FROM users WHERE id = $1',
      [req.userId]
    );
    req.userNickname = rows[0]?.nickname;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// POST /api/messages/:messageId/read — пометить сообщение прочитанным
router.post('/:messageId/read', authMiddleware, async (req, res) => {
  const { messageId } = req.params;
  try {
    const m = await pool.query(
      'SELECT room_id FROM messages WHERE id = $1',
      [messageId]
    );
    if (m.rows.length === 0) return res.status(404).send('Message not found');
    const roomId = m.rows[0].room_id;

    // проверяем членство по nickname
    const mem = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND nickname = $2',
      [roomId, req.userNickname]
    );
    if (mem.rowCount === 0) return res.status(403).send('Not a member');

    await pool.query(
      'UPDATE messages SET is_read = TRUE WHERE id = $1',
      [messageId]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('Error marking read:', err);
    res.status(500).send('Error marking read');
  }
});

module.exports = router;
