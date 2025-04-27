const WebSocket = require('ws');

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('User connected');

        ws.on('message', (message) => {
            console.log('Received:', message);

            // Отправляем сообщение всем клиентам
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        });

        ws.on('close', () => {
            console.log('User disconnected');
        });
    });
}

module.exports = setupWebSocket;
