// server/routes/messages.js
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;
    next();
  } catch {
    res.status(401).send('Invalid token');
  }
}

// Пометить сообщение прочитанным
router.post('/:messageId/read', authMiddleware, async (req, res) => {
  const { messageId } = req.params;
  try {
    // найти комнату сообщения
    const msgRes = await pool.query(
      'SELECT room_id FROM messages WHERE id = $1',
      [messageId]
    );
    if (msgRes.rowCount === 0) return res.status(404).send('Message not found');
    const roomId = msgRes.rows[0].room_id;

    // проверить членство
    const memRes = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id=$1 AND user_login=$2',
      [roomId, req.userLogin]
    );
    if (memRes.rowCount === 0) return res.status(403).send('Not a member');

    // обновить флаг
    await pool.query(
      'UPDATE messages SET is_read = TRUE WHERE id = $1',
      [messageId]
    );
    res.send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error marking read');
  }
});

module.exports = router;
