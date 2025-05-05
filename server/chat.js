// server/chat.js
const WebSocket = require('ws');
const jwt       = require('jsonwebtoken');
const pool      = require('./db');
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  const clients = new Map(); // ws → { nickname, roomId }

  wss.on('connection', ws => {
    ws.on('message', async raw => {
      let data;
      try { data = JSON.parse(raw); }
      catch { return; }

      // Обработаем JOIN
      if (data.type === 'join') {
        try {
          // payload.login — это login из secret_profile
          const p = jwt.verify(data.token, JWT_SECRET);

          // Ищем никнейм в таблице users по login
          const res = await pool.query(
            'SELECT nickname FROM users WHERE id = (SELECT id FROM secret_profile WHERE login = $1)',
            [p.login]
          );
          const nick = res.rows[0]?.nickname;
          if (!nick) throw new Error('No nickname for ' + p.login);

          clients.set(ws, { nickname: nick, roomId: data.roomId });
        } catch (e) {
          console.error('Invalid join token or lookup error', e);
        }
        return;
      }

      // Обработаем MESSAGE
      if (data.type === 'message') {
        let p;
        try {
          p = jwt.verify(data.token, JWT_SECRET);
        } catch {
          return;
        }

        // Снова ищем nickname по login
        const res = await pool.query(
          'SELECT nickname FROM users WHERE id = (SELECT id FROM secret_profile WHERE login = $1)',
          [p.login]
        );
        const sender = res.rows[0]?.nickname;
        if (!sender) {
          console.error('Cannot find nickname for', p.login);
          return;
        }

        const { roomId, text } = data;

        // Сохраняем в таблицу messages (именно sender_nickname, а не sender_login!)
        await pool.query(
          'INSERT INTO messages (room_id, sender_nickname, text) VALUES ($1, $2, $3)',
          [roomId, sender, text]
        );

        // Шлём всем участникам комнаты
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
