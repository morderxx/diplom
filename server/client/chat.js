const WS_URL = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;

const socket = new WebSocket(WS_URL);

socket.addEventListener('open', () => {
    console.log('Connected to chat');
});

socket.addEventListener('message', (event) => {
    const chatBox = document.getElementById('chat-box');

    let data;

    try {
        data = JSON.parse(event.data); // ПАРСИМ СТРОКУ
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
        const username = localStorage.getItem('login') || 'Аноним'; // берем имя из localStorage
        const message = {
            username,
            time: new Date().toLocaleTimeString(),
            message: input.value
        };
        socket.send(JSON.stringify(message)); // ОТПРАВЛЯЕМ JSON, а не просто текст
        input.value = '';
    }
}
