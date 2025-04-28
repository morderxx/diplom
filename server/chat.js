const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const clients = new Map();

function setupChatServer(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        const token = req.url.split('token=')[1];
        if (!token) return ws.close();

        jwt.verify(token, 'SECRET_KEY', async (err, user) => {
            if (err) return ws.close();

            const res = await pool.query('SELECT nickname FROM users WHERE id = $1', [user.id]);
            const nickname = res.rows[0]?.nickname;
            if (!nickname) return ws.close();

            ws.nickname = nickname;
            clients.set(ws, { nickname, roomId: null });

            ws.on('message', async (message) => {
                const data = JSON.parse(message);

                if (data.type === 'join') {
                    clients.get(ws).roomId = data.roomId;
                }

                if (data.type === 'message') {
                    const { roomId, text } = data;
                    await pool.query(
                        'INSERT INTO messages (room_id, sender_nickname, text) VALUES ($1, $2, $3)',
                        [roomId, nickname, text]
                    );

                    const payload = {
                        type: 'message',
                        message: { senderNickname: nickname, text }
                    };

                    clients.forEach((clientInfo, clientWs) => {
                        if (clientInfo.roomId === roomId) {
                            clientWs.send(JSON.stringify(payload));
                        }
                    });
                }
            });

            ws.on('close', () => {
                clients.delete(ws);
            });
        });
    });
}

module.exports = { setupChatServer };
