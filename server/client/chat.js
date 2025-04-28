// client/chat.js
const API_URL = '/api';
const token    = localStorage.getItem('token');
const username = localStorage.getItem('login');

// Выводим свой логин
document.getElementById('current-user').textContent = username;

let socket = null;
let currentRoomId = null;

// 1) Загрузка списка пользователей
async function loadUsers() {
  const res = await fetch(`${API_URL}/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return console.error('Не удалось загрузить пользователей');
  const users = await res.json();

  const ul = document.getElementById('users-list');
  ul.innerHTML = '';
  users.forEach(u => {
    if (u.login === username) return; // не себя
    const li = document.createElement('li');
    li.textContent = u.nickname || u.login;
    li.onclick = () => openPrivateChat(u.login, u.nickname || u.login);
    ul.appendChild(li);
  });
}

// 2) Создаем/открываем приватную комнату
async function openPrivateChat(otherLogin, otherNick) {
  // POST /api/rooms с именем interlocutor
  const res = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: otherNick,        // отображаемое имя комнаты
      is_group: false,
      members: [username, otherLogin]
    })
  });
  if (!res.ok) return console.error('Не удалось создать комнату');
  const { roomId } = await res.json();
  joinRoom(roomId);
}

// 3) Подключаемся к комнате через WS и грузим историю
async function joinRoom(roomId) {
  // Закрываем предыдущее соединение
  if (socket) socket.close();

  currentRoomId = roomId;
  document.getElementById('chat-box').innerHTML = '';

  // Показываем чат
  document.getElementById('chat-section').classList.add('active');

  // Новый WebSocket
  socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  socket.onopen = () => {
    socket.send(JSON.stringify({ type:'join', token, roomId }));
  };
  socket.onmessage = ev => {
    const d = JSON.parse(ev.data);
    if (d.type === 'message') {
      appendMessage(d.sender, d.text, d.time);
    }
  };

  // REST-история
  const h = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!h.ok) return console.error('Не удалось загрузить историю');
  (await h.json()).forEach(m => {
    appendMessage(m.sender_login, m.text, m.time);
  });
}

// 4) Отображение сообщения
function appendMessage(sender, text, time) {
  const chatBox = document.getElementById('chat-box');
  const w = document.createElement('div'); w.className = 'message-wrapper';
  const m = document.createElement('div');
  m.className = sender === username ? 'my-message' : 'other-message';

  const info = document.createElement('div');
  info.className = 'message-info';
  info.textContent = `${sender} • ${new Date(time).toLocaleTimeString([], {
    hour:'2-digit', minute:'2-digit'
  })}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  const txt = document.createElement('div');
  txt.className = 'message-text';
  txt.textContent = text;

  bubble.append(txt);
  m.append(info, bubble);
  w.appendChild(m);
  chatBox.appendChild(w);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 5) Отправка сообщения
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

// Привязки
document.getElementById('send-btn').onclick = sendMessage;
document.getElementById('message').onkeypress = e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
};

// Старт
loadUsers();
