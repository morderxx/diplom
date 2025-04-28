const API_URL = '/api';
const token = localStorage.getItem('token');
const username = localStorage.getItem('login');

let socket = null;
let currentRoomId = null;

// ————————————————————————————
// 1) Загрузка списка комнат
// ————————————————————————————
async function loadRooms() {
  const res = await fetch(`${API_URL}/rooms`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    console.error('Не удалось загрузить комнаты');
    return;
  }
  const rooms = await res.json();
  const ul = document.getElementById('rooms-list');
  ul.innerHTML = '';

  rooms.forEach(room => {
    const li = document.createElement('li');
    li.textContent = room.is_group
      ? (room.name || `Группа #${room.id}`)
      : `Приват с ${room.name || room.id}`;
    li.dataset.id = room.id;
    li.addEventListener('click', () => joinRoom(room.id));
    ul.appendChild(li);
  });
}

// ————————————————————————————
// 2) Загрузка списка пользователей
// ————————————————————————————
async function loadUsers() {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const users = await res.json();

    const roomsList = document.getElementById('rooms-list');
    roomsList.innerHTML = '';

    users.forEach(user => {
        if (user === username) return; // не показывать себя
        const li = document.createElement('li');
        li.textContent = user;
        li.addEventListener('click', () => openPrivateChat(user));
        roomsList.appendChild(li);
    });
}


// ————————————————————————————
// 3) Создать/открыть приватную комнату
// ————————————————————————————
async function openPrivateChat(otherLogin) {
  const payload = {
    is_group: false,
    members: [username, otherLogin]
  };
  const res = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    console.error('Не удалось создать приватную комнату');
    return;
  }
  const { roomId } = await res.json();
  joinRoom(roomId);
}

// ————————————————————————————
// 4) Войти в комнату: WS-join + загрузка истории
// ————————————————————————————
async function joinRoom(roomId) {
  // Закрываем предыдущий WS
  if (socket) socket.close();

  currentRoomId = roomId;
  document.getElementById('chat-box').innerHTML = '';

  // Открываем WebSocket
  const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  socket = new WebSocket(WS_URL);

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      type: 'join',
      token,
      roomId
    }));
  });

  socket.addEventListener('message', event => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        appendMessage(data.sender, data.text, data.time);
      }
    } catch (e) {
      console.error('Ошибка обработки WS-сообщения', e);
    }
  });

  // REST-запрос за историей
  const res = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    console.error('Не удалось загрузить историю сообщений');
    return;
  }
  const history = await res.json();
  history.forEach(msg =>
    appendMessage(msg.sender_login, msg.text, msg.time)
  );
}

// ————————————————————————————
// Отображение сообщения
// ————————————————————————————
function appendMessage(sender, text, time) {
  const chatBox = document.getElementById('chat-box');

  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';

  const message = document.createElement('div');
  message.className = sender === username ? 'my-message' : 'other-message';

  const info = document.createElement('div');
  info.className = 'message-info';
  info.textContent = `${sender} • ${new Date(time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const textDiv = document.createElement('div');
  textDiv.className = 'message-text';
  textDiv.textContent = text;

  bubble.appendChild(textDiv);
  message.appendChild(info);
  message.appendChild(bubble);
  wrapper.appendChild(message);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ————————————————————————————
// Отправка сообщения
// ————————————————————————————
function sendMessage() {
  const input = document.getElementById('message');
  const text = input.value.trim();
  if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify({
    type: 'message',
    token,
    roomId: currentRoomId,
    text
  }));
  input.value = '';
}

// ————————————————————————————
// Инициализация
// ————————————————————————————
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('message').addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});
document.getElementById('new-group-btn').addEventListener('click', () => {
  // здесь можно впоследствии открыть форму создания групповой комнаты
  alert('Форма создания групповой комнаты пока не реализована');
});

// Загрузка при старте
loadRooms();
loadUsers();
