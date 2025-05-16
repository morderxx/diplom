// server/client/chat.js
document.addEventListener('DOMContentLoaded', () => {
  const API_URL      = '/api';
  const token        = localStorage.getItem('token');
  const userNickname = localStorage.getItem('nickname');
  const renderedFileIds = new Set();

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

async function endCall(status = 'finished') {
  // 1) Снимаем захват ресурсов
  clearInterval(callTimerIntvl);
  if (pc) pc.close();
  pc = null;
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  // 2) Считаем длительность
  const durationSec = Math.floor((Date.now() - callStartTime) / 1000);

  // 3) Отправляем данные на сервер и ждём ответа с message_text
  let call;
  try {
    const res = await fetch(`${API_URL}/rooms/${currentRoom}/calls`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        initiator:  userNickname,
        recipient:  currentPeer,
        started_at: new Date(callStartTime).toISOString(),
        ended_at:   new Date().toISOString(),
        status,
        duration:   durationSec
      })
    });
    if (!res.ok) throw new Error(await res.text());
    call = await res.json();
  } catch (err) {
    console.error('Ошибка сохранения звонка в БД:', err);
    appendSystem('⚠️ Не удалось сохранить данные звонка на сервер.');
  }

  // 4) Отрисовываем централизованный баннер тем же текстом, что и сервер
  if (call && call.message_text) {
    appendCenterCall(call.message_text);
  }

  // 5) Закрываем окно звонка
  hideCallWindow();
}









  // Авто-рост textarea
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  // Прикрепление файла
  attachBtn.onclick = () => fileInput.click();
fileInput.onchange = () => {
  (async () => {
    try {
      if (!currentRoom) {
        alert('Сначала выберите чат');
        return;
      }
      const file = fileInput.files[0];
      if (!file) return;

      // 1) Загружаем файл
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
        return;
      }

      // 2) Ответ сервера
      const { fileId, filename, mimeType, time } = await res.json();

      // 3) WS‑рассылка
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type:     'file',
          roomId:   currentRoom,
          sender:   userNickname,
          fileId,
          filename,
          mimeType,
          time
        }));
      }

      

    } catch (err) {
      console.error('Ошибка в fileInput.onchange:', err);
    } finally {
      // сброс input и восстановление кнопки send
      fileInput.value = '';
      sendBtn.disabled = false;   // если вдруг был disabled
    }
  })();
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

  // При получении потока добавляем его в аудиоплеер
// При получении потока добавляем его в аудиоплеер и явно запускаем воспроизведение
  pc.ontrack = e => {
    const stream = e.streams && e.streams[0];
    if (!stream) {
      console.warn('Аудиопоток не получен.');
      return;
    }
    console.log('Получен аудиопоток от собеседника, tracks=', stream.getAudioTracks());

    // Назначаем стрим и снимаем возможные заглушки
    remoteAudio.srcObject = stream;
    remoteAudio.muted = false;
    remoteAudio.volume = 1.0;

    // Пробуем сразу запустить (ловим ошибку автоплей)
    remoteAudio.play()
      .then(() => console.log('remoteAudio.play() успешно'))
      .catch(err => console.error('remoteAudio.play() отклонён:', err));
  };
}


async function startCall() {
  createPeerConnection();
  showCallWindow(currentPeer, false);
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.send(JSON.stringify({
      type: 'webrtc-offer',
      from: userNickname,
      to: currentPeer,
      payload: offer
    }));
  } catch (err) {
    console.error('Ошибка получения аудио при звонке:', err);
  }
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
  try {
    if (!pc) return;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.send(JSON.stringify({
      type: 'webrtc-answer',
      from: userNickname,
      payload: answer
    }));

    callStatus.textContent = 'В разговоре';
    answerBtn.style.display = 'none';
  } catch (err) {
    console.error('Ошибка при ответе на звонок:', err);
  }
};


 cancelBtn.onclick = () => {
   if (socket && socket.readyState === WebSocket.OPEN) {
     socket.send(JSON.stringify({
       type: 'webrtc-cancel',
       from: userNickname,
       roomId: currentRoom
     }));
   }
   endCall('cancelled');
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

// 2) Обработчик клика для Lightbox — открывает blob: или прямой URL и качает по data-src
document.getElementById('chat-box').addEventListener('click', e => {
  if (e.target.tagName === 'IMG' && e.target.dataset.src) {
    // Показываем превью (это будет blob: или прямой URL в зависимости от состояния)
    lightboxImg.src = e.target.src;
    // Скачивать будем по исходному API-URL
    overlay.dataset.url      = e.target.dataset.src;
    overlay.dataset.filename = e.target.dataset.filename;
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
  // 1. Закрываем старый сокет и очищаем контейнер
  if (socket) socket.close();
  renderedFileIds.clear();
  currentRoom = roomId;
  document.getElementById('chat-box').innerHTML = '';

  // Показываем заголовок и peer
  const header = document.getElementById('chat-header');
  const peerEl = document.getElementById('chat-peer');
  peerEl.textContent = currentPeer;
  header.classList.remove('hidden');
  document.getElementById('chat-section').classList.add('active');

  // 2. Настраиваем WebSocket для live-событий
  socket = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') +
      location.host
  );
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'join', token, roomId }));
  };
  socket.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    switch (msg.type) {
      case 'webrtc-cancel':
        endCall('cancelled');
        break;

      case 'file':
        appendFile(msg.sender, msg.fileId, msg.filename, msg.mimeType, msg.time);
        break;

      case 'message':
        if (msg.callId != null) {
          appendMessage(msg.sender, msg.text, msg.time, msg.callId);
        } else {
          appendMessage(msg.sender, msg.text, msg.time);
        }
        break;

      case 'call':
        appendCenterCall(msg.message_text);
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

      default:
        console.warn('Unknown message type:', msg.type);
    }
  };

  // 3. Параллельно запрашиваем историю сообщений и звонков
  const [msgRes, callRes] = await Promise.all([
    fetch(`${API_URL}/rooms/${roomId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    }),
    fetch(`${API_URL}/rooms/${roomId}/calls`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  ]);

  const messages = msgRes.ok ? await msgRes.json() : [];
  const calls    = callRes.ok ? await callRes.json() : [];

  // 4. Приводим к общему формату
  const formattedMsgs = messages.map(m => ({
    type:     'message',
    time:     m.time,
    sender:   m.sender_nickname,
    text:     m.text,
    fileId:   m.file_id,
    filename: m.filename,
    mimeType: m.mime_type,
    callId:   m.call_id
  }));

  const formattedCalls = calls.map(c => ({
    type:         'call',
    time:         c.started_at,
    message_text: c.message_text
  }));

  // 5. Объединяем и сортируем по времени
  const history = [...formattedMsgs, ...formattedCalls]
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  // 6. Отрисовываем всё в порядке времени
  history.forEach(item => {
    if (item.type === 'message') {
      if (item.fileId != null) {
        appendFile(item.sender, item.fileId, item.filename, item.mimeType, item.time);
      } else {
        appendMessage(item.sender, item.text, item.time, item.callId);
      }
    } else if (item.type === 'call') {
      appendCenterCall(item.message_text);
    }
  });
}

  
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


async function appendFile(sender, fileId, filename, mimeType, time) {
  // 1) Дубли
  if (renderedFileIds.has(fileId)) return;
  renderedFileIds.add(fileId);

  // 2) Общая разметка
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

  // Сразу вставляем в DOM (без ожидания fetch)
  msgEl.append(info, bubble);
  wrapper.appendChild(msgEl);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;

  // 3) Тип изображения
  if (mimeType.startsWith('image/')) {
    const apiSrc = `${API_URL}/files/${fileId}`;
    const img = document.createElement('img');
    // убираем alt, чтобы не писался текст «Загрузка…»
    img.alt = '';
    // для лайтбокса
    img.dataset.src      = apiSrc;
    img.dataset.fileId   = fileId;
    img.dataset.filename = filename;
    bubble.appendChild(img);

    // асинхронно подтягиваем blob, по готовности ставим src
    fetch(apiSrc, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.blob();
      })
      .then(blob => {
        img.src = URL.createObjectURL(blob);
        // через минуту можно очистить:
        // setTimeout(() => URL.revokeObjectURL(img.src), 60_000);
      })
      .catch(err => {
        console.warn('Не получилось blob-загрузить, делаем fallback:', err);
        img.src = apiSrc;
      });

    return;  // на этом выходим и НЕ идём в последующие блоки
  }

  // 4) Остальные типы (аудио, видео, файл)
  if (mimeType.startsWith('audio/')) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = `${API_URL}/files/${fileId}`;
    bubble.appendChild(audio);

  } else if (mimeType.startsWith('video/')) {
    const video = document.createElement('video');
    video.controls = true;
    video.src = `${API_URL}/files/${fileId}`;
    bubble.appendChild(video);

  } else {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = `📎 ${filename}`;
    link.onclick = e => {
      e.preventDefault();
      downloadFile(fileId, filename);
    };
    bubble.appendChild(link);
  }
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
