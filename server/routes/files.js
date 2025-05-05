// server/routes/files.js
const express = require('express');
const multer  = require('multer');
const pool    = require('../db');
const jwt     = require('jsonwebtoken');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Настройка multer для буферов
const upload = multer({ storage: multer.memoryStorage() });

// Middleware для JWT
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    req.userId = payload.id;
    req.roomId = req.body.roomId || req.query.roomId;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// POST /api/files — загрузка
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  const file = req.file;
  const roomId = parseInt(req.body.roomId, 10);

  if (!file || isNaN(roomId)) {
    return res.status(400).send('Missing file or roomId');
  }

  try {
    const result = await pool.query(
      `INSERT INTO files (room_id, uploader_id, filename, mime_type, content)
         VALUES ($1, $2, $3, $4, $5)
      RETURNING id, filename, mime_type, uploaded_at`,
      [roomId, req.userId, file.originalname, file.mimetype, file.buffer]
    );
    const row = result.rows[0];
    res.json({
      id: row.id,
      filename: row.filename,
      mime_type: row.mime_type,
      uploaded_at: row.uploaded_at
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).send('Error saving file');
  }
});

// GET /api/files/:id — скачивание
router.get('/:id', authMiddleware, async (req, res) => {
  const fileId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query(
      `SELECT filename, mime_type, content
         FROM files
        WHERE id = $1`,
      [fileId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('File not found');
    }
    const { filename, mime_type, content } = result.rows[0];
    res.setHeader('Content-Type', mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err) {
    console.error('File download error:', err);
    res.status(500).send('Error retrieving file');
  }
});

module.exports = router;
