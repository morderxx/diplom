const WebSocket = require('ws');
const jwt       = require('jsonwebtoken');
const pool      = require('./db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

let wss, clients;

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server });
  clients = new Map(); // ws → { nickname, roomId }

  wss.on('connection', ws => {
    ws.on('message', async raw => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

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
          const nick = r.rows[0] && r.rows[0].nickname;
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
          const sender = r.rows[0] && r.rows[0].nickname;
          if (!sender) return;

          const time = new Date().toISOString();
          await pool.query(
            `INSERT INTO messages (room_id, sender_nickname, text, time)
               VALUES ($1, $2, $3, $4)`,
            [msg.roomId, sender, msg.text, time]
          );

          wss.clients.forEach(c => {
            const info = clients.get(c);
            if (info && info.roomId === msg.roomId && c.readyState === WebSocket.OPEN) {
              c.send(JSON.stringify({
                type: 'message',
                sender,
                text: msg.text,
                time
              }));
            }
          });
        } catch (e) {
          console.error('WS message error', e);
        }
        return;
      }

      // FILE MESSAGE
      if (msg.type === 'file') {
        let senderInfo = clients.get(ws);
        if (!senderInfo && msg.roomId && msg.sender) {
          // если JOIN ещё не успел, подхватываем из сообщения
          senderInfo = { nickname: msg.sender, roomId: msg.roomId };
          clients.set(ws, senderInfo);
        }
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
    if (['webrtc-offer', 'webrtc-answer', 'webrtc-ice'].includes(msg.type)) {
  const senderInfo = clients.get(ws);
  if (!senderInfo) return;
  wss.clients.forEach(c => {
    const info = clients.get(c);
    if (
      c !== ws &&
      info &&
      info.roomId === senderInfo.roomId &&
      c.readyState === WebSocket.OPEN
    ) {
      c.send(JSON.stringify({
        type:    msg.type,
        roomId:  senderInfo.roomId,
        from:    senderInfo.nickname,
        payload: msg.payload
      }));
    }
  });
  return;
}


      if (msg.type === 'webrtc-cancel') {
        const senderInfo = clients.get(ws);
        if (!senderInfo) return;
        wss.clients.forEach(c => {
          const info = clients.get(c);
          if (
            c !== ws &&
            info &&
            info.roomId === senderInfo.roomId &&
            c.readyState === WebSocket.OPEN
          ) {
            c.send(JSON.stringify({
              type:   'webrtc-cancel',
              from:   senderInfo.nickname,
              roomId: senderInfo.roomId
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

function getWss() {
  return { wss, clients };
}

module.exports = { setupWebSocket, getWss };
