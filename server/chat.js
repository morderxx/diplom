// server/chat.js
const WebSocket = require('ws');
const jwt       = require('jsonwebtoken');
const pool      = require('./db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  const clients = new Map(); // ws → { nickname, roomId }

  wss.on('connection', ws => {
    ws.on('message', async raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      // JOIN
      if (msg.type === 'join') {
        try {
          const payload = jwt.verify(msg.token, JWT_SECRET);
          const login   = payload.login;
          const r       = await pool.query(
            `SELECT u.nickname
               FROM users u
               JOIN secret_profile s ON s.id = u.id
              WHERE s.login = $1`,
            [login]
          );
          const nick = r.rows[0]?.nickname;
          if (!nick) throw new Error('No nick');
          clients.set(ws, { nickname: nick, roomId: msg.roomId });
        } catch (e) {
          console.error('WS join error', e);
        }
        return;
      }

      // TEXT MESSAGE
      if (msg.type === 'message') {
        try {
          const payload = jwt.verify(msg.token, JWT_SECRET);
          const login   = payload.login;
          const r       = await pool.query(
            `SELECT u.nickname
               FROM users u
               JOIN secret_profile s ON s.id = u.id
              WHERE s.login = $1`,
            [login]
          );
          const sender = r.rows[0]?.nickname;
          if (!sender) return;

          await pool.query(
            `INSERT INTO messages (room_id, sender_nickname, text, time)
               VALUES ($1,$2,$3,$4)`,
            [msg.roomId, sender, msg.text, new Date().toISOString()]
          );

          wss.clients.forEach(c => {
            const info = clients.get(c);
            if (info && info.roomId === msg.roomId && c.readyState === WebSocket.OPEN) {
              c.send(JSON.stringify({
                type: 'message',
                sender,
                text: msg.text,
                time: new Date().toISOString()
              }));
            }
          });
        } catch (e) {
          console.error('WS message error', e);
        }
        return;
      }

      // FILE MESSAGE (signaling done via files route)
      if (msg.type === 'file') {
        // файл уже сохранён HTTP роутом, просто ретранслируем
        const senderInfo = clients.get(ws);
        if (!senderInfo) return;
        wss.clients.forEach(c => {
          const info = clients.get(c);
          if (info && info.roomId === senderInfo.roomId && c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify({
              type:     'file',
              sender:   senderInfo.nickname,
              fileId:   msg.fileId,
              filename: msg.filename,
              mimeType: msg.mimeType,
              time:     msg.time
            }));
          }
        });
        return;
      }

      // WEBRTC SIGNALING
      if (msg.type === 'webrtc-offer' || msg.type === 'webrtc-answer' || msg.type === 'webrtc-ice') {
        const senderInfo = clients.get(ws);
        if (!senderInfo) return;
        wss.clients.forEach(c => {
          const info = clients.get(c);
          if (c !== ws && info && info.roomId === senderInfo.roomId && c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify({
              type:    msg.type,
              from:    senderInfo.nickname,
              payload: msg.payload
            }));
          }
        });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });
}

module.exports = setupWebSocket;
