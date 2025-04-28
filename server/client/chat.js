const API_URL      = '/api';
const token        = localStorage.getItem('token');
const username     = localStorage.getItem('login');
const userNickname = localStorage.getItem('nickname');

// Показать свой никнейм
document.getElementById('current-user').textContent = userNickname;

let socket = null;
let currentRoomId = null;

// 1) Загрузка списка комнат
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

// 2) Загрузка списка пользователей
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
    if (u.login === username) return;
    const li = document.createElement('li');
    li.textContent = u.nickname;
    // передаём в openPrivateChat: (логин, ник)
    li.onclick = () => openPrivateChat(u.login, u.nickname);
    ul.appendChild(li);
  });
}

// 3) Создать/открыть приватную комнату
async function openPrivateChat(otherLogin, otherNick) {
  try {
    // сначала пробуем найти по name
    const roomsRes = await fetch(`${API_URL}/rooms`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const rooms = roomsRes.ok ? await roomsRes.json() : [];

    const exist = rooms.find(r =>
      !r.is_group && r.name === otherNick
    );
    if (exist) {
      return joinRoom(exist.id);
    }

    // создаём новую комнату — members: [логины]
    const res = await fetch(`${API_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: null,           // сервер подсчитает display-name по никнейму второго
        is_group: false,
        members: [username, otherLogin]
      })
    });

    if (!res.ok) {
      console.error('Не удалось создать комнату:', await res.text());
      return;
    }

    const { roomId } = await res.json();
    await loadRooms();
    joinRoom(roomId);

  } catch (err) {
    console.error('Ошибка при открытии приватного чата:', err);
  }
}

// 4) Войти в комнату
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
    appendMessage(m.sender_login, m.text, m.time)
  );
}

// 5) Добавить сообщение в DOM
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

// 6) Отправка сообщения
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
document.getElementById('message').addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

// Старт
loadRooms();
loadUsers();
