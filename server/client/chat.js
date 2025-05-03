// client/chat.js
const API_URL      = '/api';
const token        = localStorage.getItem('token');
const username     = localStorage.getItem('login');    // login из secret_profile
const userNickname = localStorage.getItem('nickname'); // nickname из users

// Показать свой никнейм в сайдбаре
document.getElementById('current-user').textContent = userNickname;

let socket = null;
let currentRoomId = null;

// Загрузка комнат
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
  rooms.forEach(r => {
    const li = document.createElement('li');
    li.textContent = r.name;
    li.dataset.id = r.id;
    li.onclick = () => joinRoom(r.id);
    ul.appendChild(li);
  });
}

// Загрузка пользователей
async function loadUsers() {
  const res = await fetch(`${API_URL}/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    console.error('Не удалось загрузить пользователей');
    return;
  }
  const users = await res.json();
  const ul = document.getElementById('users-list');
  ul.innerHTML = '';
  users.forEach(u => {
    if (u.nickname === userNickname) return;
    const li = document.createElement('li');
    li.textContent = u.nickname;
    li.onclick = () => openPrivateChat(u.id, u.nickname);
    ul.appendChild(li);
  });
}

// Создание/открытие приватной комнаты
async function openPrivateChat(otherId, otherNick) {
  // Проверка уже существующих комнат
  const roomsRes = await fetch(`${API_URL}/rooms`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const rooms = roomsRes.ok ? await roomsRes.json() : [];
  const exist = rooms.find(r => !r.is_group && r.name === otherNick);
  if (exist) return joinRoom(exist.id);

  // Создаём новую
  const res = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: null,
      is_group: false,
      members: [parseInt(localStorage.getItem('userId')), otherId]
    })
  });
  if (!res.ok) {
    console.error('Не удалось создать комнату:', await res.text());
    return;
  }
  const { roomId } = await res.json();
  await loadRooms();
  joinRoom(roomId);
}

// Вход в комнату
async function joinRoom(roomId) {
  if (socket) socket.close();
  currentRoomId = roomId;
  document.getElementById('chat-box').innerHTML = '';
  document.getElementById('chat-section').classList.add('active');

  socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'join', token, roomId }));
  };
  socket.onmessage = ev => {
    const d = JSON.parse(ev.data);
    if (d.type === 'message') {
      appendMessage(d.sender, d.text, d.time);
    }
  };

  const h = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!h.ok) {
    console.error('Не удалось загрузить историю сообщений');
    return;
  }
  (await h.json()).forEach(m =>
    appendMessage(m.sender, m.text, m.time)
  );
}

// Отображение сообщения
function appendMessage(sender, text, time) {
  const chatBox = document.getElementById('chat-box');
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';

  const msgEl = document.createElement('div');
  msgEl.className = sender === userNickname ? 'my-message' : 'other-message';

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

// Отправка сообщения
function sendMessage() {
  const inp = document.getElementById('message');
  const text = inp.value.trim();
  if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({
    type: 'message',
    token,
    roomId: currentRoomId,
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
