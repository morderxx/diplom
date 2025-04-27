const WS_URL = 'wss://diplom-production-df7f.up.railway.app';

const socket = new WebSocket(WS_URL);

socket.addEventListener('open', () => {
    console.log('Connected to chat');
});

socket.addEventListener('message', (event) => {
    const chatBox = document.getElementById('chat-box');
    const message = document.createElement('div');
    message.textContent = event.data;
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;
});

function sendMessage() {
    const input = document.getElementById('message');
    if (input.value.trim() !== '') {
        socket.send(input.value);
        input.value = '';
    }
}
