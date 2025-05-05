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

// Скрытый file input + кнопка 📎
const fileInput = document.createElement('input');
fileInput.type    = 'file';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

document.getElementById('attach-btn').onclick = () => fileInput.click();

// Когда выбрали файл — загружаем и шлём WS
fileInput.onchange = async () => {
  if (!currentRoom) return alert('Сначала выберите чат');
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
    const meta = await res.json(); // {id, filename, uploaded_at}

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

// Загрузить комнаты и пользователей — ваш код без изменений
async function loadRooms() { /* ... */ }
async function loadUsers() { /* ... */ }
async function openPrivateChat(otherNick) { /* ... */ }

// Вход в комнату: история + WS
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
    }
    else if (msg.type === 'file') {
      appendFileMessage(msg.sender, msg.fileId, msg.filename, msg.time);
    }
  };
}

// Рендер функций — они у вас уже есть, не трогаем
function appendMessage(sender, text, time) { /* ... */ }
function appendFileMessage(sender, fileId, filename, time) { /* ... */ }

// Отправка текста
document.getElementById('send-btn').onclick = () => { /* ... */ };
textarea.addEventListener('keypress', e => { /* ... */ });

// Старт
loadRooms();
loadUsers();
