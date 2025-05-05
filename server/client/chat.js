// server/client/chat.js
const API_URL      = '/api';
const token        = localStorage.getItem('token');
const userNickname = localStorage.getItem('nickname');

let socket      = null;
let currentRoom = null;

// Показать ник
document.getElementById('current-user').textContent = userNickname;

// Авто-рост textarea
const textarea = document.getElementById('message');
textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});

// Скрытый input для файла
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

// Кнопка 📎
document.getElementById('attach-btn').onclick = () => fileInput.click();

// Обработка выбора файла
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
    if (!res.ok) throw new Error(await res.text());
    const meta = await res.json(); // {id, filename, mime_type, uploaded_at}

    socket.send(JSON.stringify({
      type:     'file',
      token,
      roomId:   currentRoom,
      fileId:   meta.id,
      filename: meta.filename,
      time:     meta.uploaded_at
    }));

    fileInput.value = '';
  } catch (e) {
    console.error('File upload error:', e);
  }
};

// Загрузка комнат
async function loadRooms() {
  const res = await fetch(`${API_URL}/rooms`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return console.error(await res.text());
  const rooms = await res.json();
  const ul = document.getElementById('rooms-list');
  ul.innerHTML = '';
  rooms.forEach(r => {
    const li = document.createElement('li');
    li.dataset.id = r.id;
    li.textContent = r.is_group ? (r.name || `Группа #${r.id}`) 
      : (r.name || 'Чат');
    li.onclick = () => joinRoom(r.id);
    ul.appendChild(li);
  });
}

// Загрузка пользователей
async function loadUsers() {
  const res = await fetch(`${API_URL}/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return console.error(await res.text());
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

// Создать/открыть приватный чат
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
  if (exist) return joinRoom(exist.id);

  const create = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ is_group: false, members: [userNickname, otherNick] })
  });
  if (!create.ok) return console.error(await create.text());
  const { roomId } = await create.json();
  await loadRooms();
  joinRoom(roomId);
}

// Вход в комнату + WS + история
async function joinRoom(roomId) {
  if (socket) socket.close();
  currentRoom = roomId;
  document.getElementById('chat-box').innerHTML = '';
  document.getElementById('chat-section').classList.add('active');

  // REST-история
  const hist = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const messages = await hist.json();
  messages.forEach(m => {
    if (m.file_id) {
      appendFileMessage(m.sender, m.file_id, m.filename, m.time);
    } else {
      appendMessage(m.sender, m.text, m.time);
    }
  });

  // WS
  socket = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
  );
  socket.onopen = () => socket.send(JSON.stringify({ type:'join', token, roomId }));
  socket.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'message') {
      appendMessage(msg.sender, msg.text, msg.time);
    } else if (msg.type === 'file') {
      appendFileMessage(msg.sender, msg.fileId, msg.filename, msg.time);
    }
  };
}

// Рендер текстового сообщения
function appendMessage(sender, text, time) {
  const chatBox = document.getElementById('chat-box');
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';
  const msgEl = document.createElement('div');
  msgEl.className = sender === userNickname ? 'my-message' : 'other-message';
  const info = document.createElement('div');
  info.className = 'message-info';
  info.textContent = `${sender} • ${new Date(time).toLocaleTimeString([],{
    hour:'2-digit', minute:'2-digit'})}`;
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = text;
  msgEl.append(info, bubble);
  wrapper.appendChild(msgEl);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Рендер файлового сообщения
function appendFileMessage(sender, fileId, filename, time) {
  const chatBox = document.getElementById('chat-box');
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';
  const msgEl = document.createElement('div');
  msgEl.className = sender === userNickname ? 'my-message' : 'other-message';
  const info = document.createElement('div');
  info.className = 'message-info';
  info.textContent = `${sender} • ${new Date(time).toLocaleTimeString([],{
    hour:'2-digit', minute:'2-digit'})}`;
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  const link = document.createElement('a');
  link.href        = `${API_URL}/files/${fileId}`;
  link.textContent = filename;
  link.target      = '_blank';
  bubble.appendChild(link);
  msgEl.append(info, bubble);
  wrapper.appendChild(msgEl);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Отправка текста по кнопке/Enter
document.getElementById('send-btn').onclick = () => {
  const text = textarea.value.trim();
  if (text && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type:'message', token, roomId: currentRoom, text }));
    textarea.value = '';
    textarea.style.height = 'auto';
  }
};
textarea.addEventListener('keypress', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('send-btn').click();
  }
});

// старт
loadRooms();
loadUsers();
