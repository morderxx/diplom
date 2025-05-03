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
      try {
        const msg = JSON.parse(raw);

        if (msg.type === 'join') {
          // msg = { type:'join', token, roomId }
          const { token, roomId } = msg;
          const payload = jwt.verify(token, JWT_SECRET);
          ws.meta.userId   = payload.id;
          ws.meta.nickname = payload.login;
          ws.meta.roomId   = roomId;

          // Помечаем все предыдущие сообщения как прочитанные
          await pool.query(
            `UPDATE messages
               SET is_read = true
             WHERE room_id = $1
               AND sender_nickname != $2`,
            [roomId, ws.meta.nickname]
          );
        }

        else if (msg.type === 'message') {
          // msg = { type:'message', token, roomId, text }
          const { token, roomId, text } = msg;
          const payload   = jwt.verify(token, JWT_SECRET);
          const sender    = payload.login;
          const timestamp = new Date().toISOString();

          // Сохраняем в БД
          await pool.query(
            `INSERT INTO messages
               (room_id, sender_nickname, text, time, is_read)
             VALUES($1,$2,$3,$4,false)`,
            [roomId, sender, text, timestamp]
          );

          // Рассылаем всем в комнате
          wss.clients.forEach(client => {
            if (
              client.readyState === WebSocket.OPEN &&
              client.meta.roomId === roomId
            ) {
              client.send(JSON.stringify({
                type:   'message',
                sender: sender,
                text:   text,
                time:   timestamp
              }));
            }
          });
        }
      } catch (e) {
        console.error('WS error:', e);
      }
    });

    ws.on('close', () => {
      ws.meta = {};
    });
  });
}

module.exports = setupWebSocket;
