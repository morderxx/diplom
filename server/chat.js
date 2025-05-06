// server/chat.js
const WebSocket = require('ws');
const jwt       = require('jsonwebtoken');
const pool      = require('./db');
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

let wssInstance = null;

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  wssInstance = wss;
  const clients = new Map(); // ws → { nickname, roomId, userId }

  wss.on('connection', ws => {
    ws.on('message', async raw => {
      let data;
      try { data = JSON.parse(raw); } catch { return; }

      // Пользователь присоединяется к комнате
      if (data.type === 'join') {
        try {
          const payload = jwt.verify(data.token, JWT_SECRET);
          const login   = payload.login;
          const userId  = payload.id;
          const result  = await pool.query(
            `SELECT u.nickname
               FROM users u
               JOIN secret_profile s ON s.id = u.id
              WHERE s.login = $1`,
            [login]
          );
          const nick = result.rows[0]?.nickname;
          if (!nick) throw new Error('No nick');
          clients.set(ws, { nickname: nick, roomId: data.roomId, userId });
        } catch (e) {
          console.error('WS join error', e);
        }
        return;
      }

      // Текстовое сообщение
      if (data.type === 'message') {
        let payload;
        try { payload = jwt.verify(data.token, JWT_SECRET); }
        catch { return; }
        const senderId = payload.id;
        const r = await pool.query(
          `SELECT u.nickname
             FROM users u
             JOIN secret_profile s ON s.id = u.id
            WHERE s.login = $1`,
          [payload.login]
        );
        const sender = r.rows[0]?.nickname;
        if (!sender) return;

        // Сохраняем в БД
        await pool.query(
          `INSERT INTO messages (room_id, sender_nickname, text)
             VALUES ($1,$2,$3)`,
          [data.roomId, sender, data.text]
        );

        // Рассылаем всем клиентам в комнате
        wss.clients.forEach(c => {
          const info = clients.get(c);
          if (info && info.roomId === data.roomId && c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify({
              type:     'message',
              sender,
              senderId,
              text:     data.text,
              time:     new Date().toISOString()
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

// Экспорт для маршрутов файлов
function getWss() {
  return wssInstance;
}

module.exports = setupWebSocket;
module.exports.getWss = getWss;
