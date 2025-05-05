// server/routes/files.js
const express = require('express');
const multer  = require('multer');
const pool    = require('../db');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';
const upload     = multer({ storage: multer.memoryStorage() });

// JWT-middleware
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

// POST /api/files — загрузить файл + вставить в messages
router.post(
  '/',
  authMiddleware,
  upload.single('file'),
  async (req, res) => {
    try {
      const { roomId }    = req.body;
      const fileBuf       = req.file.buffer;
      const filename      = req.file.originalname;
      const mimeType      = req.file.mimetype;
      const uploaderId    = req.userId;

      // 1) сохраняем в таблице files
      const fileRes = await pool.query(
        `INSERT INTO files
           (room_id, uploader_id, filename, mime_type, content, uploaded_at)
         VALUES($1,$2,$3,$4,$5,NOW())
         RETURNING id, filename, mime_type, uploaded_at`,
        [roomId, uploaderId, filename, mimeType, fileBuf]
      );
      const file = fileRes.rows[0];

      // 2) создаём запись в messages
      await pool.query(
        `INSERT INTO messages
           (room_id, sender_nickname, file_id, text, time, is_read)
         VALUES($1,$2,$3,NULL,$4,false)`,
        [roomId, req.userLogin, file.id, file.uploaded_at]
      );

      // 3) возвращаем мета
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
