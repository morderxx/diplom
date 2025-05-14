// server/routes/messages.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');

  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userLogin = payload.login;

    const { rows } = await pool.query(`
      SELECT u.nickname
      FROM users u
      JOIN secret_profile s ON s.id = u.id
      WHERE s.login = $1;
    `, [req.userLogin]);

    if (rows.length === 0) {
      return res.status(400).send('Complete your profile first');
    }

    req.userNickname = rows[0].nickname;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    // проверка членства
    const membership = await pool.query(`
      SELECT 1 FROM room_members
      WHERE room_id = $1 AND nickname = $2
    `, [roomId, req.userNickname]);
    if (membership.rowCount === 0) {
      return res.status(403).send('Not a member');
    }

    // собираем историю с call_id, filename и mime_type через JOIN
    const { rows } = await pool.query(`
      WITH combined AS (
        -- 1) обычные сообщения и файлы (в том числе привязанные к звонку)
        SELECT
          'message'         AS type,
          m.sender_nickname,
          NULL::text        AS initiator,
          NULL::text        AS recipient,
          m.text,
          m.time,
          m.time            AS happened_at,
          m.file_id,
          f.filename,
          f.mime_type,
          NULL::timestamptz AS ended_at,
          NULL::int         AS duration,
          NULL::text        AS status,
          m.call_id
        FROM messages m
        LEFT JOIN files f
          ON m.file_id = f.id
        WHERE m.room_id = $1

        UNION ALL

        -- 2) чистые события звонка
        SELECT
          'call'            AS type,
          c.initiator       AS sender_nickname,
          c.initiator,
          c.recipient,
          NULL::text        AS text,
          c.started_at      AS time,
          c.started_at      AS happened_at,
          NULL::int         AS file_id,
          NULL::text        AS filename,
          NULL::text        AS mime_type,
          c.ended_at,
          c.duration,
          c.status,
          c.id              AS call_id
        FROM calls c
        WHERE c.room_id = $1
      )
      SELECT * FROM combined
      ORDER BY happened_at;
    `, [roomId]);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching messages:', err.stack);
    res.status(500).send('Error fetching messages');
  }
});

module.exports = router;
