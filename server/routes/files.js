// server/routes/files.js
const express   = require('express');
const multer    = require('multer');
const pool      = require('../db');
const jwt       = require('jsonwebtoken');
const { getWss } = require('../chat');
const router    = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';
const upload     = multer({ storage: multer.memoryStorage() });

// JWT → req.userId
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).send('No token');
  try {
    req.userId = jwt.verify(header.split(' ')[1], JWT_SECRET).id;
    next();
  } catch {
    res.status(401).send('Invalid token');
  }
}

// POST /api/files — загрузка файлов
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  const file   = req.file;
  const roomId = parseInt(req.body.roomId, 10);
  if (!file || isNaN(roomId)) {
    return res.status(400).send('Missing file or roomId');
  }

  try {
    // Сохраняем файл в БД
    const { rows } = await pool.query(
      `INSERT INTO files(room_id, uploader_id, filename, mime_type, content)
         VALUES ($1,$2,$3,$4,$5)
       RETURNING id, filename, mime_type   AS "mimeType", uploaded_at AS "time"`,
      [roomId, req.userId, file.originalname, file.mimetype, file.buffer]
    );
    const meta = rows[0];

    // Сохраняем сообщение с file_id
    const u = await pool.query(`SELECT nickname FROM users WHERE id = $1`, [req.userId]);
    const sender = u.rows[0]?.nickname || 'Unknown';
    await pool.query(
      `INSERT INTO messages(room_id, sender_nickname, file_id, time)
         VALUES ($1,$2,$3,$4)`,
      [roomId, sender, meta.id, meta.time]
    );

    // Отдаём клиенту метаданные
    res.json(meta);

    // Шлём WS-уведомление
    const wss = getWss();
    if (wss) {
      const msg = {
        type:     'file',
        sender,
        senderId: req.userId,
        fileId:   meta.id,
        filename: meta.filename,
        mimeType: meta.mimeType,
        time:     meta.time
      };
      wss.clients.forEach(c => {
        if (c.readyState === c.OPEN) c.send(JSON.stringify(msg));
      });
    }
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).send('Error saving file');
  }
});

// GET /api/files/:id — загрузка/просмотр файла
router.get('/:id', async (req, res) => {
  const fileId = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query(
      `SELECT filename, mime_type AS "mimeType", content
         FROM files
        WHERE id = $1`,
      [fileId]
    );
    if (!rows.length) {
      return res.status(404).send('File not found');
    }
    const { filename, mimeType, content } = rows[0];

    res.setHeader('Content-Type', mimeType);
    const encoded = encodeURIComponent(filename);
    const disposition = mimeType.startsWith('image/') ||
                        mimeType.startsWith('audio/') ||
                        mimeType.startsWith('video/')
                      ? 'inline'
                      : 'attachment';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encoded}`
    );

    res.send(content);
  } catch (err) {
    console.error('File download error:', err);
    res.status(500).send('Error retrieving file');
  }
});

module.exports = router;
