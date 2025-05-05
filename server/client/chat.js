// client/chat.js

const API_URL      = '/api';
const token        = localStorage.getItem('token');
const userNickname = localStorage.getItem('nickname');

let socket      = null;
let currentRoom = null;

// Показываем в шапке свой никнейм
document.getElementById('current-user').textContent = userNickname;

// Авто-рост textarea
const textarea = document.getElementById('message');
textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});

// Скрытый <input type="file"> для кнопки 📎
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

// Кнопка 📎 открывает диалог выбора
document.getElementById('attach-btn').onclick = () => fileInput.click();

// При выборе файла — загружаем и сбрасываем input
fileInput.onchange = async () => {
  if (!currentRoom) {
    alert('Сначала выберите чат');
    return;
  }
  const file = fileInput.files[0];
  if (!file) return;

  const form = new FormData();
  form.append('file', file);
  form.append('roomId', currentRoom);

  const res = await fetch(`${API_URL}/files`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form
  });
  if (!res.ok) {
    console.error('Ошибка загрузки файла:', await res.text());
  }
  fileInput.value = '';
};

// TODO: запись голосового сообщения
document.getElementById('voice-btn').onclick = () => {
  alert('Здесь будет запись голосового сообщения');
};

// 1) Загрузка списка комнат
async function loadRooms() {
  const res = await fetch(`${API_URL}/rooms`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    console.error('Ошибка загрузки комнат:', await res.text());
    return;
  }
  const rooms = await res.json();
  const ul = document.getElementById('rooms-list');
  ul.innerHTML = '';
  rooms.forEach(r => {
    const li = document.createElement('li');
    li.dataset.id = r.id;
    if (r.is_group) {
      li.textContent = r.name || `Группа #${r.id}`;
    } else {
      const other = (r.members || []).find(n => n !== userNickname);
      li.textContent = other || '(без имени)';
    }
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
    console.error('Ошибка загрузки пользователей:', await res.text());
    return;
  }
  const users = await res.json();
  const ul = document.getElementById('users-list');
  ul.innerHTML = '';
  users.forEach(u => {
    if (u.nickname === userNickname) return;
    const li = document.createElement('li');
    li.textContent = u.nickname;
    li.onclick = () => openPrivateChat(u.nickname);
    ul.appendChild(li);
  });
}

// 3) Создать или открыть приватный чат
async function openPrivateChat(otherNick) {
  const roomsRes = await fetch(`${API_URL}/rooms`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const rooms = roomsRes.ok ? await roomsRes.json() : [];
  const key = [userNickname, otherNick].sort().join('|');
  const exist = rooms.find(r =>
    !r.is_group &&
    Array.isArray(r.members) &&
    r.members.sort().join('|') === key
  );
  if (exist) {
    return joinRoom(exist.id);
  }
  const create = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      is_group: false,
      members:  [userNickname, otherNick]
    })
  });
  if (!create.ok) {
    console.error('Ошибка создания чата:', await create.text());
    return;
  }
  const { roomId } = await create.json();
  await loadRooms();
  joinRoom(roomId);
}

// 4) Вход в комнату, установка WS и загрузка истории
async function joinRoom(roomId) {
  if (socket) socket.close();
  currentRoom = roomId;
  document.getElementById('chat-box').innerHTML = '';
  document.getElementById('chat-section').classList.add('active');

  socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  socket.onopen = () => socket.send(JSON.stringify({ type: 'join', token, roomId }));
  socket.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'message') {
      appendMessage(msg.sender, msg.text, msg.time);
    } else if (msg.type === 'file') {
      appendFile(msg.sender, msg.fileId, msg.filename, msg.mimeType, msg.time);
    }
  };

  // REST-история текстовых сообщений
  const histRes = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!histRes.ok) {
    console.error('Ошибка загрузки истории:', await histRes.text());
    return;
  }
  const history = await histRes.json();
  history.forEach(m => appendMessage(m.sender_nickname, m.text, m.time));
}

// 5) Отрисовка текстового сообщения
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

// 6) Отрисовка файлового сообщения с разным рендерингом
function appendFile(sender, fileId, filename, mimeType, time) {
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

  // Определяем тип и создаём соответствующий элемент
  let contentEl;
  if (mimeType.startsWith('image/')) {
    contentEl = document.createElement('img');
    contentEl.src = `${API_URL}/files/${fileId}`;
    contentEl.style.maxWidth = '200px';
    contentEl.style.borderRadius = '8px';
  } else if (mimeType.startsWith('audio/')) {
    contentEl = document.createElement('audio');
    contentEl.controls = true;
    contentEl.src = `${API_URL}/files/${fileId}`;
  } else if (mimeType.startsWith('video/')) {
    contentEl = document.createElement('video');
    contentEl.controls = true;
    contentEl.style.maxWidth = '200px';
    contentEl.src = `${API_URL}/files/${fileId}`;
  } else {
    // Остальные — ссылка на скачивание
    contentEl = document.createElement('a');
    contentEl.href = `${API_URL}/files/${fileId}`;
    contentEl.textContent = `📎 ${filename}`;
    contentEl.target = '_blank';
  }

  bubble.appendChild(contentEl);
  msgEl.append(info, bubble);
  wrapper.appendChild(msgEl);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 7) Отправка текстового сообщения
function sendMessage() {
  const inp = document.getElementById('message');
  const text = inp.value.trim();
  if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'message', token, roomId: currentRoom, text }));
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
