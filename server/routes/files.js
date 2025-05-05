// server/routes/files.js
const express = require('express');
const multer  = require('multer');
const pool    = require('../db');
const jwt     = require('jsonwebtoken');
const { getWss } = require('../chat');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';
const upload = multer({ storage: multer.memoryStorage() });

// JWT middleware
function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).send('No token');
  try {
    req.userId = jwt.verify(h.split(' ')[1], JWT_SECRET).id;
    next();
  } catch {
    res.status(401).send('Invalid token');
  }
}

// POST /api/files
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  const file   = req.file;
  const roomId = parseInt(req.body.roomId, 10);
  if (!file || isNaN(roomId)) return res.status(400).send('Missing file or roomId');

  try {
    const { rows } = await pool.query(
      `INSERT INTO files(room_id,uploader_id,filename,mime_type,content)
         VALUES($1,$2,$3,$4,$5)
       RETURNING id, filename, mime_type AS "mimeType", uploaded_at AS "time"`,
      [roomId, req.userId, file.originalname, file.mimetype, file.buffer]
    );
    const meta = rows[0];
    res.json(meta);

    // broadcast через WS
    const wss = getWss();
    if (wss) {
      // получаем nickname
      const u = await pool.query(
        `SELECT nickname FROM users WHERE id = $1`, [req.userId]
      );
      const sender = u.rows[0]?.nickname;
      const msg = {
        type:     'file',
        sender,
        fileId:   meta.id,
        filename: meta.filename,
        mimeType: meta.mimeType,
        time:     meta.time
      };
      wss.clients.forEach(c => {
        // у клиента в setupWebSocket хранится roomId в clients map
        c.send(JSON.stringify(msg));
      });
    }

  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).send('Error saving file');
  }
});

// GET /api/files/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const fileId = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query(
      `SELECT filename, mime_type AS "mimeType", content
         FROM files WHERE id = $1`, [fileId]
    );
    if (!rows.length) return res.status(404).send('Not found');
    const { filename, mimeType, content } = rows[0];
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (e) {
    console.error('File download error:', e);
    res.status(500).send('Error retrieving file');
  }
});

module.exports = router;
