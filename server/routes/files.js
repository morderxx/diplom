// server/routes/files.js
const express       = require('express');
const multer        = require('multer');
const jwt           = require('jsonwebtoken');
const pool          = require('../db');
const router        = express.Router();
require('dotenv').config();

const JWT_SECRET    = process.env.JWT_SECRET || 'secret123';

// Настройка multer (храним файл в памяти для вставки в БД)
const storage = multer.memoryStorage();
const upload  = multer({ storage });

// Middleware авторизации JWT
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  try {
    const token   = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId    = payload.id;
    req.userLogin = payload.login;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// POST /api/files — загрузить файл
router.post(
  '/',
  authMiddleware,
  upload.single('file'),
  async (req, res) => {
    try {
      const { roomId } = req.body;
      const fileBuf    = req.file.buffer;
      const filename   = req.file.originalname;
      const mimeType   = req.file.mimetype;
      const uploaderId = req.userId;

      const result = await pool.query(
        `INSERT INTO files
           (room_id, uploader_id, filename, mime_type, content, uploaded_at)
         VALUES($1,$2,$3,$4,$5,NOW())
         RETURNING id, filename, mime_type, uploaded_at`,
        [roomId, uploaderId, filename, mimeType, fileBuf]
      );

      const file = result.rows[0];
      res.json({
        id:          file.id,
        filename:    file.filename,
        mime_type:   file.mime_type,
        uploaded_at: file.uploaded_at
      });
    } catch (err) {
      console.error('File upload error:', err);
      res.status(500).send('Error uploading file');
    }
  }
);

// GET /api/files/:id — скачать файл
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id, 10);
    const result = await pool.query(
      `SELECT filename, mime_type, content
         FROM files
        WHERE id = $1`,
      [fileId]
    );
    if (result.rowCount === 0) {
      return res.status(404).send('File not found');
    }
    const file = result.rows[0];
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Type', file.mime_type);
    res.send(file.content);
  } catch (err) {
    console.error('File download error:', err);
    res.status(500).send('Error downloading file');
  }
});

module.exports = router;
