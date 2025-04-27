const WS_URL = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
const socket = new WebSocket(WS_URL);

// Получаем ник пользователя из localStorage
const username = localStorage.getItem('username') || 'Аноним';

socket.addEventListener('open', () => {
    console.log('Connected to chat');
});

socket.addEventListener('message', async (event) => {
    const chatBox = document.getElementById('chat-box');

    let data;

    try {
        data = await event.data.text(); // Преобразуем Blob в текст
        data = JSON.parse(data);
    } catch (e) {
        console.error('Ошибка обработки сообщения', e);
        return;
    }

    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-wrapper');

    const messageInfo = document.createElement('div');
    messageInfo.classList.add('message-info');
    messageInfo.textContent = `${data.username} | ${data.time}`;

    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    messageText.textContent = data.message;

    messageWrapper.appendChild(messageInfo);
    messageWrapper.appendChild(messageText);

    if (data.username === username) {
        messageWrapper.classList.add('my-message');
    } else {
        messageWrapper.classList.add('other-message');
    }

    chatBox.appendChild(messageWrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
});

function sendMessage() {
    const input = document.getElementById('message');
    if (input.value.trim() !== '') {
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const messageData = {
            username: username,
            message: input.value.trim(),
            time: time
        };

        socket.send(JSON.stringify(messageData));
        input.value = '';
    }
}
