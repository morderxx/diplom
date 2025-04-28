// client/chat.js
const API_URL = '/api';
const token    = localStorage.getItem('token');
const username = localStorage.getItem('login');

let socket = null;
let currentRoomId = null;

// 1) Загрузить комнаты
async function loadRooms() {
  const res = await fetch(`${API_URL}/rooms`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return console.error('Не удалось загрузить комнаты');
  const rooms = await res.json();
  const ul = document.getElementById('rooms-list');
  ul.innerHTML = '';
  rooms.forEach(r => {
    const li = document.createElement('li');
    li.textContent = r.is_group 
      ? (r.name || `Группа #${r.id}`) 
      : `Приват #${r.id}`;
    li.dataset.id = r.id;
    li.onclick = () => joinRoom(r.id);
    ul.appendChild(li);
  });
}

// 2) Загрузить пользователей
async function loadUsers() {
  const res = await fetch(`${API_URL}/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return console.error('Не удалось загрузить пользователей');
  const users = await res.json();
  const ul = document.getElementById('users-list');
  ul.innerHTML = '';
  users.forEach(u => {
    if (u.login === username) return;
    const li = document.createElement('li');
    li.textContent = u.nickname || u.login;
    li.onclick = () => openPrivateChat(u.login);
    ul.appendChild(li);
  });
}

// 3) Создать/открыть приватную комнату
async function openPrivateChat(other) {
  const res = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      is_group: false,
      members: [username, other]
    })
  });
  if (!res.ok) return console.error('Не удалось создать приватную комнату');
  const { roomId } = await res.json();
  joinRoom(roomId);
}

// 4) Войти в комнату и подцепиться к WS
async function joinRoom(roomId) {
  if (socket) socket.close();
  currentRoomId = roomId;
  document.getElementById('chat-box').innerHTML = '';

  socket = new WebSocket((location.protocol==='https:'?'wss://':'ws://') + location.host);
  socket.onopen = () => {
    socket.send(JSON.stringify({ type:'join', token, roomId }));
  };
  socket.onmessage = e => {
    const data = JSON.parse(e.data);
    if (data.type==='message') appendMessage(data.sender, data.text, data.time);
  };

  // REST-история
  const res = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return console.error('Не удалось загрузить историю');
  (await res.json()).forEach(m =>
    appendMessage(m.sender_login, m.text, m.time)
  );
}

// 5) Выводим сообщение
function appendMessage(sender, text, time) {
  const chatBox = document.getElementById('chat-box');
  const w = document.createElement('div'); w.className='message-wrapper';
  const m = document.createElement('div');
  m.className = sender===username ? 'my-message' : 'other-message';
  const info = document.createElement('div');
  info.className='message-info';
  info.textContent = `${sender} • ${new Date(time).toLocaleTimeString([], {
    hour:'2-digit',minute:'2-digit'})}`;
  const bubble = document.createElement('div'); bubble.className='message-bubble';
  const txt = document.createElement('div'); txt.className='message-text'; txt.textContent=text;
  bubble.appendChild(txt);
  m.appendChild(info); m.appendChild(bubble);
  w.appendChild(m);
  chatBox.appendChild(w);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 6) Отправка
function sendMessage() {
  const input = document.getElementById('message');
  const t = input.value.trim();
  if (!t||!socket||socket.readyState!==WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type:'message', token, roomId:currentRoomId, text:t }));
  input.value='';
}

// События
document.getElementById('send-btn').onclick = sendMessage;
document.getElementById('message').onkeypress = e => {
  if (e.key==='Enter') { e.preventDefault(); sendMessage(); }
};
document.getElementById('new-group-btn').onclick = () => {
  alert('Форма создания групп пока не готова');
};

// Запускаем
loadRooms();
loadUsers();
