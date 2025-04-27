const username = localStorage.getItem('login'); // Твой логин

const WS_URL = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
const socket = new WebSocket(WS_URL);

socket.addEventListener('open', () => {
    console.log('Connected to chat');
});

socket.addEventListener('message', (event) => {
    try {
        const data = JSON.parse(event.data);

        const chatBox = document.getElementById('chat-box');

        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';

        const messageDiv = document.createElement('div');
        messageDiv.className = data.login === username ? 'my-message' : 'other-message';

        const info = document.createElement('div');
        info.className = 'message-info';
        info.textContent = data.login;

        const text = document.createElement('div');
        text.className = 'message-text';
        text.textContent = data.text;

        messageDiv.appendChild(info);
        messageDiv.appendChild(text);
        wrapper.appendChild(messageDiv);
        chatBox.appendChild(wrapper);
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch (e) {
        console.error('Ошибка обработки сообщения', e);
    }
});

function sendMessage() {
    const input = document.getElementById('message');
    if (input.value.trim() !== '') {
        const payload = {
            login: username,
            text: input.value.trim()
        };
        socket.send(JSON.stringify(payload));
        input.value = '';
    }
}
