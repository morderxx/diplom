// client/chat.js
const API_URL      = '/api';
const token        = localStorage.getItem('token');
const userNickname = localStorage.getItem('nickname');

let socket      = null;
let currentRoom = null;

// 1) Показать свой никнейм
document.getElementById('current-user').textContent = userNickname;

// 2) Авто-рост поля ввода
const textarea = document.getElementById('message');
textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});

// 3) Скрытый input для файла
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

// 4) При клике на 📎 — открываем выбор
document.getElementById('attach-btn').onclick = () => fileInput.click();

// 5) При выборе файла — загружаем и шлём уведомление
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

  try {
    const res = await fetch(`${API_URL}/files`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form
    });
    if (!res.ok) {
      console.error('Ошибка загрузки файла:', await res.text());
      return;
    }
    const meta = await res.json(); // { id, filename, mime_type, uploaded_at }

    // Шлём по WebSocket уведомление о файле
    socket.send(JSON.stringify({
      type:     'file',
      token,
      roomId:   currentRoom,
      fileId:   meta.id,
      filename: meta.filename,
      mimeType: meta.mime_type,
      time:     meta.uploaded_at
    }));

    fileInput.value = '';
  } catch (e) {
    console.error('Network error during file upload', e);
  }
};

// 6) Загрузка списка комнат
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
      // Для приватного чата берём имя второго участника
      const keyMembers = (r.members || []).filter(n => n !== userNickname);
      li.textContent = keyMembers[0] || '(без имени)';
    }
    li.onclick = () => joinRoom(r.id);
    ul.appendChild(li);
  });
}

// 7) Загрузка списка пользователей
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

// 8) Создать или открыть приватный чат по нику
async function openPrivateChat(otherNick) {
  const roomsRes = await fetch(`${API_URL}/rooms`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const rooms = roomsRes.ok ? await roomsRes.json() : [];
  // Сортируем ключ из никнеймов
  const key = [userNickname, otherNick].sort().join('|');
  const exist = rooms.find(r =>
    !r.is_group &&
    Array.isArray(r.members) &&
    r.members.sort().join('|') === key
  );
  if (exist) {
    return joinRoom(exist.id);
  }
  // Создаём новую комнату
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

// 9) Вход в комнату + WS + история
async function joinRoom(roomId) {
  if (socket) socket.close();
  currentRoom = roomId;
  document.getElementById('chat-box').innerHTML = '';
  document.getElementById('chat-section').classList.add('active');

  // Инициализируем WS
  socket = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
  );
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'join', token, roomId }));
  };
  socket.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'message') {
      appendMessage(msg.sender, msg.text, msg.time);
    } else if (msg.type === 'file') {
      appendFileMessage(
        msg.sender, msg.fileId, msg.filename, msg.mimeType, msg.time
      );
    }
  };

  // Загружаем историю сообщений
  const histRes = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!histRes.ok) {
    console.error('Ошибка загрузки истории:', await histRes.text());
    return;
  }
  const history = await histRes.json();
  history.forEach(m => {
    if (m.filename) {
      appendFileMessage(
        m.sender, m.file_id, m.filename, m.mime_type, m.time
      );
    } else {
      appendMessage(m.sender, m.text, m.time);
    }
  });
}

// 10) Рендер текстового сообщения
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

// 11) Рендер файлового сообщения
function appendFileMessage(sender, fileId, filename, mimeType, time) {
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
  const link = document.createElement('a');
  link.href = `${API_URL}/files/${fileId}`;
  link.textContent = filename;
  link.target = '_blank';
  bubble.appendChild(link);
  msgEl.append(info, bubble);
  wrapper.appendChild(msgEl);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 12) Отправка текстового сообщения по Enter/кнопке
function sendMessage() {
  const text = textarea.value.trim();
  if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({
    type:   'message',
    token,
    roomId: currentRoom,
    text
  }));
  textarea.value = '';
  textarea.style.height = 'auto';
}
document.getElementById('send-btn').onclick = sendMessage;
textarea.addEventListener('keypress', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Инициализация
loadRooms();
loadUsers();
