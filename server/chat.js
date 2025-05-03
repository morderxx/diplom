// server/chat.js
const WebSocket = require('ws');
const jwt       = require('jsonwebtoken');
const pool      = require('./db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  // Храним мапу ws -> { userId, nickname, roomId }
  wss.on('connection', ws => {
    ws.meta = {};

    ws.on('message', async raw => {
      try {
        const msg = JSON.parse(raw);
        switch (msg.type) {
          case 'join': {
            // msg: { type:'join', token, roomId }
            const { token, roomId } = msg;
            const payload = jwt.verify(token, JWT_SECRET);
            ws.meta.userId   = payload.id;
            ws.meta.nickname = payload.login;
            ws.meta.roomId   = roomId;
            // отметим все сообщения в комнате как прочитанные для этого пользователя
            await pool.query(
              `UPDATE messages SET is_read = true
               WHERE room_id = $1 AND receiver_id = $2`,
              [roomId, ws.meta.userId]
            );
            break;
          }
          case 'message': {
            // msg: { type:'message', token, roomId, text }
            const { token, roomId, text } = msg;
            const payload = jwt.verify(token, JWT_SECRET);
            const senderId   = payload.id;
            const timestamp  = new Date().toISOString();
            // определяем получателя: для приватного чата два участника
            // получатель — тот, чей room_member entry != sender
            const otherRes = await pool.query(
              `SELECT user_id FROM room_members WHERE room_id = $1 AND user_id != $2` ,
              [roomId, senderId]
            );
            const receiverId = otherRes.rows[0]?.user_id;
            // сохраняем в БД
            await pool.query(
              `INSERT INTO messages
                 (room_id, sender_id, receiver_id, text, time, is_read)
               VALUES($1,$2,$3,$4,$5,false)`,
              [roomId, senderId, receiverId, text, timestamp]
            );
            // рассылаем сообщение всем подключённым в этой комнате
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN && client.meta.roomId === roomId) {
                client.send(JSON.stringify({
                  type: 'message',
                  sender: payload.login,
                  text,
                  time: timestamp
                }));
              }
            });
            break;
          }
        }
      } catch (e) {
        console.error('WS error:', e);
      }
    });

    ws.on('close', () => {
      // Очистка метаданных
      ws.meta = {};
    });
  });
}

module.exports = setupWebSocket;
