// server/client/chat.js
document.addEventListener('DOMContentLoaded', () => {
  const API_URL      = '/api';
  const token        = localStorage.getItem('token');
  const userNickname = localStorage.getItem('nickname');

  if (!token || !userNickname) {
    window.location.href = 'index.html';
    return;
  }

  let socket         = null;
  let currentRoom    = null;
  let currentPeer = null;  
  let mediaRecorder;
  let audioChunks    = [];
  let pc             = null;
  let localStream    = null;
  let callStartTime  = null;
  let callTimerIntvl = null;

  const stunConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  // UI elements
  document.getElementById('current-user').textContent = userNickname;
  const textarea     = document.getElementById('message');
  const attachBtn    = document.getElementById('attach-btn');
  const callBtn      = document.getElementById('call-btn');
  const sendBtn      = document.getElementById('send-btn');
  const voiceBtn     = document.getElementById('voice-btn');

  // File input
  const fileInput    = document.createElement('input');
  fileInput.type     = 'file';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  // Call window elements
  const callWindow   = document.getElementById('call-window');
  const callTitle    = document.getElementById('call-title');
  const callStatus   = document.getElementById('call-status');
  const callTimerEl  = document.getElementById('call-timer');
  const answerBtn    = document.getElementById('call-answer');
  const cancelBtn    = document.getElementById('call-cancel');
  const minimizeBtn  = document.getElementById('call-minimize');
  const remoteAudio  = document.getElementById('remote-audio');

  // Lightbox elements
  const overlay      = document.getElementById('lightbox-overlay');
  const lightboxImg  = document.getElementById('lightbox-image');
  const lbCloseBtn   = document.getElementById('lightbox-close');
  const lbDownloadBtn= document.getElementById('lightbox-download');

  // Добавляет системное сообщение в чат
  function appendSystem(text) {
    const chatBox = document.getElementById('chat-box');
    const el = document.createElement('div');
    el.className = 'system-message';
    el.textContent = text;
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
// В самом начале chat.js:
function appendCenterCall(text) {
  const chatBox = document.getElementById('chat-box');
  const wrapper = document.createElement('div');
  wrapper.className = 'system-call-wrapper';

  const el = document.createElement('div');
  el.className = 'system-call';
  el.textContent = text;

  wrapper.appendChild(el);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}
  // Показать окно звонка
  function showCallWindow(peer, incoming = false) {
    currentPeer = peer;  
    callTitle.textContent = `Звонок с ${peer}`;
    callStatus.textContent = incoming ? 'Входящий звонок' : 'Ожидание ответа';
    callTimerEl.textContent = '00:00';
    answerBtn.style.display = incoming ? 'inline-block' : 'none';
    cancelBtn.textContent = incoming ? 'Отклонить' : 'Отмена';
    callWindow.classList.remove('hidden');
    callStartTime = Date.now();
    callTimerIntvl = setInterval(() => {
      const sec = Math.floor((Date.now() - callStartTime) / 1000);
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      callTimerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  // Скрыть окно звонка
  function hideCallWindow() {
    clearInterval(callTimerIntvl);
    callWindow.classList.add('hidden');
  }

  // Завершить звонок
async function endCall(message, status = 'finished') {
  clearInterval(callTimerIntvl);
  if (pc) pc.close();
  pc = null;
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  // 1) Локальное уведомление
  appendSystem(message || `Звонок завершён. Длительность ${callTimerEl.textContent}`);

  // 2) Собираем данные звонка
  const startedISO  = new Date(callStartTime).toISOString();
  const endedISO    = new Date().toISOString();
  const durationSec = Math.floor((Date.now() - callStartTime) / 1000);

  // 3) Отправляем на бэкенд
  try {
    await fetch(`${API_URL}/rooms/${currentRoom}/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        initiator:  userNickname,
        recipient:  currentPeer,
        started_at: startedISO,
        ended_at:   endedISO,
        status:     status,      // 'finished' или 'cancelled'
        duration:   durationSec
      })
    });
  } catch (err) {
    console.error('Не удалось сохранить звонок в БД:', err);
  }

  hideCallWindow();
}




  // Авто-рост textarea
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  // Прикрепление файла
  attachBtn.onclick = () => fileInput.click();
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

  // Голосовое сообщение
  voiceBtn.onclick = async () => {
    if (!currentRoom) return alert('Сначала выберите чат');
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      voiceBtn.textContent = '🎤';
      voiceBtn.disabled = true;
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size) audioChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        const form = new FormData();
        form.append('file', file);
        form.append('roomId', currentRoom);
        const res = await fetch(`${API_URL}/files`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: form
        });
        if (!res.ok) console.error('Ошибка загрузки голосового сообщения:', await res.text());
        voiceBtn.disabled = false;
      };
      mediaRecorder.start();
      voiceBtn.textContent = '■';
    } catch (err) {
      console.error('Ошибка доступа к микрофону:', err);
      alert('Не получилось получить доступ к микрофону');
    }
  };

  // Настройка WebRTC
  function createPeerConnection() {
    pc = new RTCPeerConnection(stunConfig);
    pc.onicecandidate = e => {
      if (e.candidate && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'webrtc-ice', payload: e.candidate }));
      }
    };
    pc.ontrack = e => {
      remoteAudio.srcObject = e.streams[0];
    };
  }

  async function startCall() {
    createPeerConnection();
    showCallWindow(currentPeer, false);
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
     socket.send(JSON.stringify({
    type: 'webrtc-offer',
    from: userNickname,
    to: currentPeer,        // **передаём**, чтобы на другом конце знали, кто звонит
    payload: offer
  }));
  }

  async function handleOffer(offer) {
    createPeerConnection();
    showCallWindow(currentPeer, true);
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    await pc.setRemoteDescription(offer);
  }

  async function handleAnswer(answer) {
    if (!pc) return;
    await pc.setRemoteDescription(answer);
    callStatus.textContent = 'В разговоре';
    answerBtn.style.display = 'none';
  }

  async function handleIce(candidate) {
    if (pc) await pc.addIceCandidate(candidate);
  }

  // Управление звонком
  callBtn.onclick = () => {
    if (socket && socket.readyState === WebSocket.OPEN) startCall();
  };
  
 answerBtn.onclick = async () => {
  if (!pc) return;
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.send(JSON.stringify({ type: 'webrtc-answer',from: userNickname, payload: answer }));
  callStatus.textContent = 'В разговоре';
  answerBtn.style.display = 'none';
};

 cancelBtn.onclick = () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    // шлём отмену и roomId, чтобы сервер переслал другому
    socket.send(JSON.stringify({
      type:   'webrtc-cancel',
      from: userNickname,
      roomId: currentRoom
    }));
  }
  // своё окно закрываем
  endCall('Вы отменили звонок', 'cancelled');
};

 // minimizeBtn.onclick = () => callWindow.classList.toggle('minimized');

  // Перетаскивание окна звонка
  let dragging = false, dx = 0, dy = 0;
  document.querySelector('.call-header').addEventListener('mousedown', e => {
    dragging = true;
    dx = e.clientX - callWindow.offsetLeft;
    dy = e.clientY - callWindow.offsetTop;
  });
  document.addEventListener('mousemove', e => {
    if (dragging) {
      callWindow.style.left = `${e.clientX - dx}px`;
      callWindow.style.top  = `${e.clientY - dy}px`;
    }
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  // Обработчики лайтбокса
  document.getElementById('chat-box').addEventListener('click', e => {
    if (e.target.tagName === 'IMG' && e.target.src.includes('/api/files/')) {
      lightboxImg.src = e.target.src;
      overlay.dataset.url = e.target.src;
      const parts = e.target.src.split('/');
      overlay.dataset.filename = decodeURIComponent(parts.pop());
      overlay.classList.remove('hidden');
    }
  });
  lbCloseBtn.onclick = () => overlay.classList.add('hidden');
  lbDownloadBtn.onclick = () => {
    const url = overlay.dataset.url;
    const filename = overlay.dataset.filename;
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });

  // Загрузка и отправка чата
  async function loadRooms() {
    const res = await fetch(`${API_URL}/rooms`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return console.error(await res.text());
    const rooms = await res.json();
    const ul = document.getElementById('rooms-list');
    ul.innerHTML = '';
    rooms.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r.is_group
        ? (r.name || `Группа #${r.id}`)
        : (r.members.find(n => n !== userNickname) || '(без имени)');
      li.dataset.id = r.id;
        li.onclick = () => {
       // если это не группа — один на один, то peer = другой участник
       if (!r.is_group) {
         currentPeer = r.members.find(n => n !== userNickname);
       } else {
         // для групп — либо имя группы, либо заголовок по id
         currentPeer = r.name || `Группа #${r.id}`;
       }
       joinRoom(r.id);
     };
      ul.appendChild(li);
    });
  }

  async function loadUsers() {
    const res = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
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

  async function openPrivateChat(otherNick) {
    currentPeer = otherNick;
    const rr = await fetch(`${API_URL}/rooms`, { headers: { Authorization: `Bearer ${token}` } });
    const rooms = rr.ok ? await rr.json() : [];
    const key = [userNickname, otherNick].sort().join('|');
    const ex = rooms.find(r =>
      !r.is_group && r.members.sort().join('|') === key
    );
    if (ex) return joinRoom(ex.id);

    const cr = await fetch(`${API_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ is_group: false, members: [userNickname, otherNick] })
    });
    const { roomId } = await cr.json();
    await loadRooms();
    joinRoom(roomId);
  }
  

  function appendCall({ initiator, recipient, status, happened_at, ended_at, duration }) {
    const chatBox = document.getElementById('chat-box');
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    // выровняем «как у других», но отличим цветом
    const msgEl = document.createElement('div');
    msgEl.className = 'call-message'; 
  
    // основной контент звонка
    const info = document.createElement('div');
    info.className = 'call-info';
    // форматируем длительность и время
    const time  = new Date(happened_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const durStr = duration
      ? new Date(duration * 1000).toISOString().substr(11,8)
      : '--:--:--';
  
    info.innerHTML = `
      <div>📞 <strong>${initiator}</strong> → <strong>${recipient}</strong></div>
      <div>${status} • ${durStr} • ${time}</div>
    `;
  
    msgEl.appendChild(info);
    wrapper.appendChild(msgEl);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  
async function joinRoom(roomId) {
  if (socket) socket.close();
  currentRoom = roomId;
  document.getElementById('chat-box').innerHTML = '';
  document.getElementById('chat-section').classList.add('active');

  // Настраиваем WebSocket
  socket = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') +
      location.host
  );
  socket.onopen = () =>
    socket.send(JSON.stringify({ type: 'join', token, roomId }));
  socket.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    switch (msg.type) {
      case 'webrtc-cancel':
        endCall('Собеседник отменил звонок', 'cancelled');
        break;

      case 'message':
        appendMessage(msg.sender, msg.text, msg.time);
        break;

      case 'file':
        appendFile(
          msg.sender,
          msg.fileId,
          msg.filename,
          msg.mimeType,
          msg.time
        );
        break;

      case 'webrtc-offer':
        currentPeer = msg.from;
        handleOffer(msg.payload);
        showCallWindow(currentPeer, true);
        break;

      case 'webrtc-answer':
        handleAnswer(msg.payload);
        break;

      case 'webrtc-ice':
        handleIce(msg.payload);
        break;

      case 'call': {
        // Формируем текст системного блока
        const time = new Date(msg.started_at)
          .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const durStr = msg.duration
          ? new Date(msg.duration * 1000).toISOString().substr(11, 8)
          : '--:--:--';
        const text = `📞 ${msg.initiator} → ${msg.recipient} • ${msg.status} • ${durStr} • ${time}`;

        appendCenterCall(text);
        break;
      }

      default:
        console.warn('Unknown message type:', msg.type);
    }  // ← закрываем switch

  };   // ← закрываем стрелочную функцию onmessage


  // ─── Загрузка всей истории из одного эндпоинта ───────────────────────────
  const res = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    console.error(await res.text());
    return;
  }
  const history = await res.json();

console.log('=== Проверка call_id в history ===');
history.forEach(m => {
  console.log('HISTORY ITEM:', m.text, 'call_id=', m.call_id, 'type=', m.type);

  // 3) Текстовое сообщение, привязанное к звонку (call_id)
  // 1) Текстовые сообщения, привязанные к звонку
  if (m.call_id != null) {
    // Приведём текст к тому же формату или просто выведем m.text
    appendCenterCall(m.text);
    return;
  }

  // 2) «Чистые» события звонка
  if (m.type === 'call') {
    const time = new Date(m.happened_at)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const durStr = m.duration
      ? new Date(m.duration * 1000).toISOString().substr(11, 8)
      : '--:--:--';
    const text = `📞 ${m.initiator} → ${m.recipient} • ${m.status} • ${durStr} • ${time}`;
    appendCenterCall(text);
    return;
  }
  // 2) Файловое сообщение (картинка/аудио/видео)
  if (m.file_id !== null) {
    appendFile(
      m.sender_nickname,
      m.file_id,
      m.filename,
      m.mime_type,
      m.time
    );
    return;
  }

  // 4) Обычное текстовое сообщение
  if (m.text !== null) {
    appendMessage(
      m.sender_nickname,
      m.text,
      m.time
      // callId не передаём — по умолчанию null
    );
    return;
  }
  console.warn('Неизвестный элемент истории:', m);
});


}  // <-- закрыли функцию joinRoom
  
function appendMessage(sender, text, time, callId = null) {
  const chatBox = document.getElementById('chat-box');

  // 1) Сообщение, привязанное к звонку — отдельный div
  if (callId !== null) {
    const el = document.createElement('div');
    el.className = 'call-event';    // <-- только этот класс
    el.textContent = text;
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
    return;
  }

  // 2) Обычное сообщение — как было раньше
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



  async function downloadFile(fileId, filename) {
    try {
      const res = await fetch(`${API_URL}/files/${fileId}`);
      if (!res.ok) throw new Error('Fetch error');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
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
      contentEl.textContent = `📎 ${filename}`;
      contentEl.onclick = e => {
        e.preventDefault();
        downloadFile(fileId, filename);
      };
    }
    bubble.appendChild(contentEl);
    msgEl.append(info, bubble);
    wrapper.appendChild(msgEl);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function sendMessage() {
    const text = textarea.value.trim();
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'message', token, roomId: currentRoom, text }));
    textarea.value = '';
  }
  sendBtn.onclick = sendMessage;
  textarea.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  // Initialization
  loadRooms();
  loadUsers();
});
