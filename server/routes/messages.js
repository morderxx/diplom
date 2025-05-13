// Импорт необходимых модулей
const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Middleware: извлечение login и nickname из токена
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

// GET /api/rooms/:roomId/messages — история сообщений и звонков
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  const { roomId } = req.params;

  try {
    // Проверка членства
    const membership = await pool.query(`
      SELECT 1
      FROM room_members
      WHERE room_id = $1 AND nickname = $2;
    `, [roomId, req.userNickname]);

    if (membership.rowCount === 0) {
      return res.status(403).send('Not a member');
    }

    // Собираем историю с call_id
    const { rows } = await pool.query(`
      WITH combined AS (
        -- 1) Обычные сообщения и файлы (включая системные)
        SELECT
          'message'         AS type,
          sender_nickname   AS sender_nickname,
          sender_nickname   AS initiator,
          NULL::text        AS recipient,
          text,
          time              AS time,
          time              AS happened_at,
          file_id,
          filename,
          mime_type,
          NULL::timestamptz AS ended_at,
          NULL::int         AS duration,
          NULL::text        AS status,
          call_id           -- <--- добавили сюда
        FROM messages
        WHERE room_id = $1

        UNION ALL

        -- 2) Звонки (как отдельные события)
        SELECT
          'call'            AS type,
          initiator         AS sender_nickname,
          initiator,
          recipient,
          NULL::text        AS text,
          started_at        AS time,
          started_at        AS happened_at,
          NULL::int         AS file_id,
          NULL::text        AS filename,
          NULL::text        AS mime_type,
          ended_at,
          duration,
          status,
          id                AS call_id   -- <--- и здесь
        FROM calls
        WHERE room_id = $1
      )
      SELECT *
      FROM combined
      ORDER BY happened_at;
    `, [roomId]);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).send('Error fetching messages');
  }
});

module.exports = router;
