// server/chat.js
const WebSocket = require('ws');
const pool      = require('./db');
const jwt       = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

let wss;
const clients = new Map(); // ws → { userLogin, rooms: Set<roomId> }

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', ws => {
    let userLogin = null;

    ws.on('message', async raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      // ————————————————
      // 1) АУТЕНТИФИКАЦИЯ
      if (msg.type === 'auth') {
        try {
          const payload = jwt.verify(msg.token, JWT_SECRET);
          userLogin = payload.login;
          clients.set(ws, { userLogin, rooms: new Set() });
        } catch {
          return ws.close();
        }
        return;
      }
      const info = clients.get(ws);
      if (!info) return; // без auth дальше не пускаем

      // ————————————————
      // 2) JOIN — подписаться на комнату
      if (msg.type === 'join') {
        info.rooms.add(msg.roomId);
        return;
      }

      // ————————————————
      // 3) MESSAGE — новое текстовое сообщение
      if (msg.type === 'message') {
        const { roomId, text } = msg;
        // сохраняем в БД
        const { rows } = await pool.query(
          `INSERT INTO messages (room_id, sender_login, receiver_login, text)
             VALUES ($1,$2,$3,$4) RETURNING time`,
          [ roomId, info.userLogin, msg.to || null, text ]
        );
        const time = rows[0].time;
        // рассылаем всем в комнате
        broadcastToRoom(roomId, {
          type:    'message',
          roomId,
          from:    info.userLogin,
          text,
          time,
          isRead:  false
        });
        return;
      }

      // ————————————————
      // 4) READ — отметить прочитанные
      if (msg.type === 'read') {
        await pool.query(
          `UPDATE messages
             SET is_read = TRUE
           WHERE room_id=$1
             AND receiver_login = $2
             AND is_read = FALSE`,
          [ msg.roomId, info.userLogin ]
        );
        return;
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });
}

// утилита для рассылки события всем WS-клиентам в комнате
function broadcastToRoom(roomId, data) {
  const json = JSON.stringify(data);
  for (const [client, info] of clients.entries()) {
    if (info.rooms.has(roomId) && client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

module.exports = { setupWebSocket, broadcastToRoom };
