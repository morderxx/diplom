// client/chat.js

document.addEventListener('DOMContentLoaded', () => {
  const API_URL      = '/api';
  const token        = localStorage.getItem('token');
  const userNickname = localStorage.getItem('nickname');

  let socket      = null;
  let currentRoom = null;

  // Показываем ник
  document.getElementById('current-user').textContent = userNickname;

  // Авто-рост textarea
  const textarea = document.getElementById('message');
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  // Скрытое <input type="file"> для кнопки 📎
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  document.getElementById('attach-btn').onclick = () => fileInput.click();

  fileInput.onchange = async () => {
    if (!currentRoom) return alert('Сначала выберите чат');
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
    if (!res.ok) console.error('Ошибка загрузки файла:', await res.text());
    fileInput.value = '';
  };

  document.getElementById('voice-btn').onclick = () => {
    alert('Запись голосового сообщения пока не реализована');
  };

  // 1) Загрузка комнат
  async function loadRooms() {
    const res = await fetch(`${API_URL}/rooms`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return console.error(await res.text());
    const rooms = await res.json();
    const ul = document.getElementById('rooms-list');
    ul.innerHTML = '';
    rooms.forEach(r => {
      const li = document.createElement('li');
      li.dataset.id = r.id;
      li.textContent = r.is_group
        ? (r.name || `Группа #${r.id}`)
        : (r.members.find(n => n !== userNickname) || '(без имени)');
      li.onclick = () => joinRoom(r.id);
      ul.appendChild(li);
    });
  }

  // 2) Загрузка пользователей
  async function loadUsers() {
    const res = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${token}` } });
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

  // 3) Открыть приватный чат
  async function openPrivateChat(otherNick) {
    const roomsRes = await fetch(`${API_URL}/rooms`, { headers: { 'Authorization': `Bearer ${token}` } });
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

  // 4) Вход в комнату + WS + история
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

    const histRes = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!histRes.ok) return console.error(await histRes.text());
    const history = await histRes.json();
    history.forEach(m => {
      if (m.file_id) {
        appendFile(m.sender_nickname, m.file_id, m.filename, m.mime_type, m.time);
      } else {
        appendMessage(m.sender_nickname, m.text, m.time);
      }
    });
  }

  // 5) appendMessage
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

  // helper: скачивает файл как Blob, сохраняя правильное UTF-8 имя
  async function downloadFile(fileId, filename) {
    try {
      const res  = await fetch(`${API_URL}/files/${fileId}`);
      if (!res.ok) throw new Error('Fetch error');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
      alert('Не удалось скачать файл');
    }
  }

  // 6) appendFile
  function appendFile(sender, fileId, filename, mimeType, time) {
    let displayName = filename;
    try { displayName = decodeURIComponent(escape(filename)); } catch {}

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
    bubble.className = 'message-bubble media-bubble';

    let contentEl;
    if (mimeType.startsWith('image/')) {
      contentEl = document.createElement('img');
      contentEl.src = `${API_URL}/files/${fileId}`;
    } else if (mimeType.startsWith('audio/')) {
      contentEl = document.createElement('audio');
      contentEl.controls = true;
      contentEl.src = `${API_URL}/files/${fileId}`;
    } else if (mimeType.startsWith('video/')) {
      contentEl = document.createElement('video');
      contentEl.controls = true;
      contentEl.src = `${API_URL}/files/${fileId}`;
    } else {
      contentEl = document.createElement('a');
      contentEl.href = '#';
      contentEl.textContent = `📎 ${displayName}`;
      contentEl.style.color = '#065fd4';
      contentEl.onclick = e => {
        e.preventDefault();
        downloadFile(fileId, displayName);
      };
    }

    bubble.appendChild(contentEl);
    msgEl.append(info, bubble);
    wrapper.appendChild(msgEl);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // 7) sendMessage
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

  // ========== Lightbox ==========
  const overlay     = document.getElementById('lightbox-overlay');
  const lightboxImg = document.getElementById('lightbox-image');
  const btnClose    = document.getElementById('lightbox-close');
  const btnDownload = document.getElementById('lightbox-download');

  if (overlay && lightboxImg && btnClose && btnDownload) {
    document.getElementById('chat-box').addEventListener('click', e => {
      if (e.target.tagName === 'IMG' && e.target.src.includes('/api/files/')) {
        lightboxImg.src         = e.target.src;
        overlay.dataset.url     = e.target.src;
        const parts             = e.target.src.split('/');
        overlay.dataset.filename = decodeURIComponent(parts.pop());
        overlay.classList.remove('hidden');
      }
    });

    btnClose.onclick = () => {
      overlay.classList.add('hidden');
      lightboxImg.src = '';
    };

    btnDownload.onclick = () => {
      const url      = overlay.dataset.url;
      const filename = overlay.dataset.filename;
      downloadFile(url.split('/').pop(), filename);
    };

    overlay.addEventListener('click', e => {
      if (e.target === overlay) btnClose.click();
    });
  }

  // Инициализация
  loadRooms();
  loadUsers();
});
