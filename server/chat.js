// server/chat.js
const WebSocket = require('ws');
const jwt       = require('jsonwebtoken');
const pool      = require('./db');
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  const clients = new Map(); // ws → { login, roomId }

  wss.on('connection', ws => {
    ws.on('message', async raw => {
      let data;
      try { data = JSON.parse(raw); }
      catch { return; }

      // JOIN
      if (data.type === 'join') {
        try {
          const p = jwt.verify(data.token, JWT_SECRET);
          clients.set(ws, { login: p.login, roomId: data.roomId });
        } catch (e) {
          console.error('Invalid join token', e);
        }
        return;
      }

      // MESSAGE
      if (data.type === 'message') {
        let p;
        try { p = jwt.verify(data.token, JWT_SECRET); }
        catch { return; }
        const sender = p.login;
        const { roomId, text } = data;

        // Сохраняем в БД
        await pool.query(
          'INSERT INTO messages (room_id, sender_login, text) VALUES ($1,$2,$3)',
          [roomId, sender, text]
        );

        // Шлём всем в комнате
        wss.clients.forEach(client => {
          const info = clients.get(client);
          if (info && info.roomId === roomId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'message',
              sender,
              text,
              time: new Date().toISOString()
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
