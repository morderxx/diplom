// client/chat.js
const API_URL      = '/api';
const token        = localStorage.getItem('token');
const userNickname = localStorage.getItem('nickname');

let socket       = null;
let currentRoom  = null;

// Показать никнейм
document.getElementById('current-user').textContent = userNickname;

// Загрузить список комнат
async function loadRooms() {
  const res = await fetch(`${API_URL}/rooms`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw await res.text();
  const rooms = await res.json();
  const ul = document.getElementById('rooms-list');
  ul.innerHTML = '';
  rooms.forEach(r => {
    const li = document.createElement('li');
    li.textContent = r.name;
    li.dataset.id = r.id;
    li.onclick   = () => joinRoom(r.id);
    ul.appendChild(li);
  });
}

// Загрузить пользователей для нового чата
async function loadUsers() {
  const res = await fetch(`${API_URL}/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw await res.text();
  const users = await res.json();
  const ul = document.getElementById('users-list');
  ul.innerHTML = '';
  users.forEach(u => {
    if (u.nickname === userNickname) return;
    const li = document.createElement('li');
    li.textContent = u.nickname;
    li.onclick   = () => openPrivateChat(u.id, u.nickname);
    ul.appendChild(li);
  });
}

// Открыть или создать приватный чат
async function openPrivateChat(otherId, otherNick) {
  // Проверяем уже существующие
  const roomsRes = await fetch(`${API_URL}/rooms`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const rooms = await roomsRes.json();
  const exist = rooms.find(r => !r.is_group && r.name === otherNick);
  if (exist) return joinRoom(exist.id);

  // Иначе создаём
  const res = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name:     null,
      is_group: false,
      members:  [parseInt(localStorage.getItem('userId')), otherId]
    })
  });
  if (!res.ok) {
    console.error('Не удалось создать чат', await res.text());
    return;
  }
  const data = await res.json();
  await loadRooms();
  joinRoom(data.roomId);
}

// Войти в комнату
async function joinRoom(roomId) {
  // Закрыть старое WS-соединение
  if (socket) socket.close();
  currentRoom = roomId;
  document.getElementById('chat-box').innerHTML = '';
  document.getElementById('chat-section').classList.add('active');

  // Открыть WS-соединение
  socket = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
  );

  socket.onopen = () => {
    socket.send(JSON.stringify({
      type:   'join',
      token,
      roomId
    }));
  };

  socket.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'message') {
      appendMessage(msg.sender, msg.text, msg.time);
    }
  };

  // Загрузка истории через REST
  const h = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const history = await h.json();
  history.forEach(m =>
    appendMessage(m.sender, m.text, m.time)
  );
}

// Функция рендера сообщения
function appendMessage(sender, text, time) {
  const chatBox = document.getElementById('chat-box');
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';

  const msgEl = document.createElement('div');
  msgEl.className = sender === userNickname
    ? 'my-message'
    : 'other-message';

  const info = document.createElement('div');
  info.className = 'message-info';
  info.textContent = `${sender} • ${new Date(time).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  })}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const textEl = document.createElement('div');
  textEl.className = 'message-text';
  textEl.textContent = text;

  bubble.appendChild(textEl);
  msgEl.append(info, bubble);
  wrapper.appendChild(msgEl);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Отправка нового сообщения
function sendMessage() {
  const inp = document.getElementById('message');
  const text = inp.value.trim();
  if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify({
    type:   'message',
    token,
    roomId: currentRoom,
    text
  }));
  inp.value = '';
}

document.getElementById('send-btn').onclick = sendMessage;
document.getElementById('message').addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

// Инициализация
loadRooms();
loadUsers();
