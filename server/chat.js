// server/chat.js
const WebSocket = require('ws');
const jwt       = require('jsonwebtoken');
const pool      = require('./db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', ws => {
    ws.meta = {};

    ws.on('message', async raw => {
      let msg;
      try { msg = JSON.parse(raw); }
      catch { return; }

      // JOIN
      if (msg.type === 'join') {
        const { token, roomId } = msg;
        const payload = jwt.verify(token, JWT_SECRET);
        ws.meta = { userId: payload.id, nickname: payload.login, roomId };
        // проставляем прочитанные
        await pool.query(
          `UPDATE messages
             SET is_read = TRUE
           WHERE room_id=$1 AND sender_nickname != $2`,
          [roomId, ws.meta.nickname]
        );
      }

      // TEXT
      else if (msg.type === 'message') {
        const { token, roomId, text } = msg;
        const payload = jwt.verify(token, JWT_SECRET);
        const sender  = payload.login;
        const time    = new Date().toISOString();

        await pool.query(
          `INSERT INTO messages
             (room_id, sender_nickname, text, time, is_read)
           VALUES($1,$2,$3,$4,false)`,
          [roomId, sender, text, time]
        );

        wss.clients.forEach(client => {
          if (
            client.readyState === WebSocket.OPEN &&
            client.meta.roomId === roomId
          ) {
            client.send(JSON.stringify({ type:'message', sender, text, time }));
          }
        });
      }

      // FILE
      else if (msg.type === 'file') {
        const { token, roomId, fileId, filename, time } = msg;
        const payload = jwt.verify(token, JWT_SECRET);
        const sender  = payload.login;

        // сообщение в БД уже создалось в POST /api/files
        // просто рассылаем:
        wss.clients.forEach(client => {
          if (
            client.readyState === WebSocket.OPEN &&
            client.meta.roomId === roomId
          ) {
            client.send(JSON.stringify({ type:'file', sender, fileId, filename, time }));
          }
        });
      }
    });

    ws.on('close', () => { ws.meta = {}; });
  });
}

module.exports = setupWebSocket;
