// server/client/chat.js
document.addEventListener('DOMContentLoaded', () => {
  const API_URL      = '/api';
  const token        = localStorage.getItem('token');
  const userNickname = localStorage.getItem('nickname');
  const renderedFileIds = new Set();
  const roomMeta = {}; 

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
  let incomingCall = false;
  let answerTimeout  = null;
  let answeredCall = false;
  // Хелпер для формирования текста «системного» сообщения по звонку
function formatCallText({ initiator, recipient, status, duration, time }) {
  const displayTime = new Date(time)
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Пропущенный (для всех одна строка)
  if (status === 'missed') {
    return `⌛ Пропущенный/Исходящий звонок от ${initiator} к ${recipient} • ${displayTime}`;
  }

  // Отменён до ответа
  if (duration === 0 && status === 'cancelled') {
    return `⌛ Ожидание ответа • ${displayTime}`;
  }

  // Завершённый
  const durStr = new Date(duration * 1000).toISOString().substr(11, 8);
  if (duration > 0 && status === 'finished') {
    return `📞 Звонок от ${initiator} к ${recipient} завершён • ${durStr} • ${displayTime}`;
  }

  // Отменён после разговора
  return `📞 Звонок от ${initiator} к ${recipient} был отменён • ${durStr} • ${displayTime}`;
}



  const stunConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  // UI elements
  document.getElementById('current-user').textContent = userNickname;
  const textarea     = document.getElementById('message');
  const attachBtn    = document.getElementById('attach-btn');
  const callBtn      = document.getElementById('call-btn');
  const sendBtn      = document.getElementById('send-btn');
  const voiceBtn     = document.getElementById('voice-btn');
  const createGroupBtn = document.getElementById('create-group-btn');
  const inputContainer = document.getElementById('input-container');
  const readonlyNote   = document.getElementById('readonly-note');
 


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

  // Элементы модалки
const groupModal        = document.getElementById('group-modal');
const groupNameInput    = document.getElementById('group-name-input');
const userSearchInput   = document.getElementById('group-user-search');
const suggestionsList   = document.getElementById('group-user-suggestions');
const selectedUsersDiv  = document.getElementById('group-selected-users');
const cancelGroupBtn    = document.getElementById('group-cancel-btn');
const createGroupBtn2   = document.getElementById('group-create-btn');
const createChannelBtn = document.getElementById('create-channel-btn');
const addMemberBtn      = document.getElementById('add-member-btn');
const groupNameWrapper  = document.getElementById('group-name-wrapper');
const addMemberModal       = document.getElementById('add-member-modal');
const addUserSearchInput   = document.getElementById('add-user-search');
const addSuggestionsList   = document.getElementById('add-user-suggestions');
const addSelectedUsersDiv  = document.getElementById('add-selected-users');
const addCancelBtn         = document.getElementById('add-cancel-btn');
const addConfirmBtn        = document.getElementById('add-confirm-btn');
const modal      = document.getElementById('modal');
const frame      = document.getElementById('modal-frame');
const closeBtn   = document.getElementById('modal-close');

// Храним полный список пользователей (никнеймы) и выбранных
let allUsers = [];
const selectedUsers = new Set();

// Загрузка всех пользователей один раз
async function loadAllUsers() {
  const res = await fetch(`${API_URL}/users`, { headers:{ Authorization:`Bearer ${token}` } });
  if (!res.ok) return console.error('Cannot load users');
  const users = await res.json();
  allUsers = users.map(u => u.nickname);
}
loadAllUsers();

// Открыть модалку
createGroupBtn.onclick = () => {
  groupNameInput.value = '';
  userSearchInput.value = '';
  suggestionsList.innerHTML = '';
  selectedUsers.clear();
  renderSelectedUsers();
  groupModal.classList.remove('hidden');
  userSearchInput.focus();
};

// Закрыть модалку
cancelGroupBtn.onclick = () => {
  groupModal.classList.add('hidden');
};
  
const addSelectedUsers = new Set();
function renderAddSelected() {
  addSelectedUsersDiv.innerHTML = '';
  for (const nick of addSelectedUsers) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = nick;
    const rem = document.createElement('span');
    rem.className = 'remove';
    rem.textContent = '×';
    rem.onclick = () => { addSelectedUsers.delete(nick); renderAddSelected(); };
    tag.append(rem);
    addSelectedUsersDiv.append(tag);
  }
}
// Рендер выбранных
function renderSelectedUsers() {
  selectedUsersDiv.innerHTML = '';
  for (const nick of selectedUsers) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = nick;
    const rem = document.createElement('span');
    rem.className = 'remove';
    rem.textContent = '×';
    rem.onclick = () => {
      selectedUsers.delete(nick);
      renderSelectedUsers();
    };
    tag.append(rem);
    selectedUsersDiv.append(tag);
  }
}

  // Общая функция для фильтрации и показа подсказок
function setupUserSearch(inputEl, suggestionsEl, selectedSet, renderFn) {
  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim().toLowerCase();
    suggestionsEl.innerHTML = '';
    if (!q) return;
    const matches = allUsers
      .filter(n => n.toLowerCase().includes(q) && !selectedSet.has(n))
      .slice(0, 10);
    for (const nick of matches) {
      const li = document.createElement('li');
      li.textContent = nick;
      li.onclick = () => {
        selectedSet.add(nick);
        renderFn();
        inputEl.value = '';
        suggestionsEl.innerHTML = '';
        inputEl.focus();
      };
      suggestionsEl.append(li);
    }
  });
}

// Инициализируем логику для «создания группы» (как было):
setupUserSearch(userSearchInput, suggestionsList, selectedUsers, renderSelectedUsers);

// Инициализируем логику для «добавления участников»:
setupUserSearch(addUserSearchInput, addSuggestionsList, addSelectedUsers, renderAddSelected);

// Открываем нашу новую модалку при клике
addMemberBtn.onclick = () => {
  groupModal.dataset.mode = 'add';
  addUserSearchInput.value = '';
  addSuggestionsList.innerHTML = '';
  addSelectedUsers.clear();
  renderAddSelected();
  addMemberModal.classList.remove('hidden');
  addUserSearchInput.focus();
};
addCancelBtn.onclick = () => {
  addMemberModal.classList.add('hidden');
};

  addConfirmBtn.onclick = async () => {
  if (addSelectedUsers.size === 0) {
    return alert('Выберите хотя бы одного участника');
  }
  try {
    const res = await fetch(`${API_URL}/rooms/${currentRoom}/members`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ members: Array.from(addSelectedUsers) })
    });
    if (!res.ok) throw new Error(await res.text());
    addMemberModal.classList.add('hidden');
    await loadRooms();
    joinRoom(currentRoom);
  } catch (err) {
    console.error(err);
    alert('Не удалось добавить участников: ' + err.message);
  }
};

  // Нажали «Создать канал»
createChannelBtn.onclick = () => {
  // переиспользуем ту же модалку, но меняем текст заголовка
  document.querySelector('#group-modal h3').textContent = 'Новый канал';
  groupNameInput.placeholder = 'Введите название канала';
  groupModal.classList.remove('hidden');
  userSearchInput.value = '';
  suggestionsList.innerHTML = '';
  selectedUsers.clear();
  renderSelectedUsers();
  userSearchInput.focus();
};

  createGroupBtn2.onclick = async () => {
  // Определяем контекст: создание или добавление
  const mode      = groupModal.dataset.mode || 'create'; // 'create' или 'add'
  const title     = document.querySelector('#group-modal h3').textContent;
  const isChannel = /канал/i.test(title);
  const name      = groupNameInput.value.trim();
  const members   = Array.from(selectedUsers);

  // ========== Проверки для mode='create' ==========
  if (mode === 'create') {
    if (!name) {
      return alert(isChannel ? 'Укажи название канала' : 'Укажи название группы');
    }
    if (members.length === 0) {
      return alert('Добавь хотя бы одного участника');
    }

    // Обязательно добавить себя
    members.push(userNickname);

    // Формируем тело запроса
    const payload = {
      is_group:   !isChannel,
      is_channel: isChannel,
      name,
      members
    };

    // Создаём группу или канал
    try {
      const res = await fetch(`${API_URL}/rooms`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());

      const { roomId } = await res.json();
      groupModal.classList.add('hidden');
      await loadRooms();
      joinRoom(roomId);

    } catch (err) {
      console.error(err);
      alert(`Не удалось создать ${isChannel ? 'канал' : 'группу'}: ${err.message}`);
    }

  // ========== Добавление участников в существующую группу ==========
  } else {
    if (members.length === 0) {
      return alert('Выберите хотя бы одного участника');
    }

    try {
      const res = await fetch(`${API_URL}/rooms/${currentRoom}/members`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ members })
      });
      if (!res.ok) throw new Error(await res.text());

      groupModal.classList.add('hidden');
      await loadRooms();
      joinRoom(currentRoom);

    } catch (err) {
      console.error(err);
      alert('Не удалось добавить участников: ' + err.message);
    }
  }
};

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
  clearInterval(callTimerIntvl);
  clearTimeout(answerTimeout);

  currentPeer   = peer;
  incomingCall  = incoming;
  callTitle.textContent  = `Звонок с ${peer}`;
  callStatus.textContent = incoming ? 'Входящий звонок' : 'Ожидание ответа';
  callTimerEl.textContent = '00:00';
  answerBtn.style.display = incoming ? 'inline-block' : 'none';
  cancelBtn.textContent = incoming ? 'Отклонить' : 'Отмена';
  callWindow.classList.remove('hidden');

  // общий секундомер
  callStartTime = Date.now();
  callTimerIntvl = setInterval(() => {
    const sec = Math.floor((Date.now() - callStartTime) / 1000);
    const m   = String(Math.floor(sec / 60)).padStart(2, '0');
    const s   = String(sec % 60).padStart(2, '0');
    callTimerEl.textContent = `${m}:${s}`;
  }, 1000);

  // теперь таймаут ставим всегда, но внутри разделяем логику
  answerTimeout = setTimeout(() => {
    // зафиксировать 00:30
    callTimerEl.textContent = '00:30';

    if (!incoming) {
      // 1) Исходящий: шлём webrtc-hangup + endCall('missed')
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type:   'webrtc-hangup',
          roomId: currentRoom,
          from:   userNickname,
          to:     peer
        }));
      }
   // userNickname звонил → он инициатор missed
   endCall('missed', userNickname, /* sendToServer */ true);

    } else {
       endCall('missed', peer, /* sendToServer */ false);
    }
    incomingCall = false;
  }, 30_000);
}






  // Скрыть окно звонка
  function hideCallWindow() {
    clearInterval(callTimerIntvl);
    clearTimeout(answerTimeout);
    callWindow.classList.add('hidden');
  }

async function endCall(status = 'finished', initiator = userNickname, sendToServer = true) {
  // 1) Останавливаем таймер и WebRTC
  clearInterval(callTimerIntvl);
  if (pc) { pc.close(); pc = null; }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  // 2) Собираем данные звонка
  const durationSec = Math.floor((Date.now() - callStartTime) / 1000);
  const durStr      = new Date(durationSec * 1000).toISOString().substr(11, 8);
  const startedISO  = new Date(callStartTime).toISOString();
  const endedISO    = new Date().toISOString();

  // 3) Определяем, кто был получателем
  const recipient = (initiator === userNickname) ? currentPeer : userNickname;

  // 4) Формируем тексты через общий хелпер
  const fullText = formatCallText({
    initiator,
    recipient,
    status,
    duration: durationSec,
    time: endedISO
  });



  // 5) Локальная отрисовка
  const shortText = durationSec === 0
    ? `${initiator} отменил(а) звонок.`
    : `${initiator} сбросил(а) звонок.`;
    // 5) Локальная отрисовка
  appendCenterCall(fullText);

  // Только если это не пропущенный звонок, показываем «пузырёк»
  if (status !== 'missed') {
    appendMessage(initiator, shortText, endedISO, null);
  }

  // 6) Отправляем на бэкенд (если нужно)
  if (sendToServer) {
    try {
      const res = await fetch(`${API_URL}/rooms/${currentRoom}/calls`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          initiator,
          recipient,
          started_at: startedISO,
          ended_at:   endedISO,
          status,
          duration:   durationSec
        })
      });
      if (!res.ok) {
        console.error('Ошибка сохранения звонка:', await res.text());
        appendSystem(`⚠️ Сервер вернул ошибку: ${res.status}`);
      }
    } catch (err) {
      console.error('Сетевая ошибка при сохранении звонка:', err);
      appendSystem('⚠️ Сетевая ошибка при сохранении звонка.');
    }
  }

  // 7) Закрываем окно звонка
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
      socket.send(JSON.stringify({
  type:    'webrtc-ice',
  roomId:  currentRoom,
  payload: e.candidate
}));

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
  type:   'webrtc-offer',
  roomId: currentRoom,
  from:   userNickname,
  to:     currentPeer,
  payload: offer
}));
  } catch (err) {
    console.error('Ошибка получения аудио при звонке:', err);
  }
}


  async function handleOffer(offer) {
    createPeerConnection();
    showCallWindow(currentPeer, true);
    incomingCall = false;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    await pc.setRemoteDescription(offer);
  }

  async function handleAnswer(answer) {
    if (!pc) return;
    await pc.setRemoteDescription(answer);
    callStatus.textContent = 'В разговоре';
    incomingCall = false;
    answerBtn.style.display = 'none';
     answeredCall = true;
  }

  async function handleIce(candidate) {
    if (pc) await pc.addIceCandidate(candidate);
  }

  // Управление звонком
  callBtn.onclick = () => {
    if (socket && socket.readyState === WebSocket.OPEN) startCall();
  };
  
answerBtn.onclick = async () => {
  clearTimeout(answerTimeout); 
  try {
    if (!pc) return;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.send(JSON.stringify({
      type: 'webrtc-answer',
      roomId: currentRoom,
      from: userNickname,
      payload: answer
    }));
    callStartTime = Date.now();
    callStatus.textContent = 'В разговоре';
    incomingCall = false;  // сбросим флаг
    answerBtn.style.display = 'none';
    cancelBtn.textContent = 'Завершить';
  } catch (err) {
    console.error('Ошибка при ответе на звонок:', err);
  }
  answeredCall = true;
};


cancelBtn.onclick = () => {
  const inCall = callStatus.textContent === 'В разговоре';

  // если мы уже в разговоре — повесить трубку
  if (inCall) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type:   'webrtc-hangup',
        roomId: currentRoom,
        from:   userNickname,
        to:     currentPeer
      }));
    }
    endCall('finished', userNickname, /* sendToServer */ true);

  // иначе — отмена до ответа
  } else {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type:   'webrtc-cancel',
        roomId: currentRoom,
        from:   userNickname
      }));
    }
    endCall('cancelled', userNickname, /* sendToServer */ true);
  }

  hideCallWindow();
  incomingCall = false;
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

  // сброс meta и заполнение
  Object.keys(roomMeta).forEach(k => delete roomMeta[k]);
  rooms.forEach(r => {
    roomMeta[r.id] = {
      is_group:   r.is_group,
      is_channel: r.is_channel,
      name:       r.name,
      creator:    r.creator_nickname,
      members:    r.members
    };
  });

  const ul = document.getElementById('rooms-list');
  ul.innerHTML = '';
  rooms.forEach(r => {
    const li = document.createElement('li');
    let label;
    // сначала каналы
    if (r.is_channel) {
      label = r.name || `Канал #${r.id}`;
    }
    // потом группы
    else if (r.is_group) {
      label = r.name || `Группа #${r.id}`;
    }
    // иначе приватный чат
    else {
      label = r.members.find(n => n !== userNickname) || '(без имени)';
    }

    li.textContent = label;
    li.dataset.id = r.id;
    li.onclick = () => {
      // для приватного чата currentPeer = ник другого
      // для групп/каналов — просто показываем label
      currentPeer = (!r.is_group && !r.is_channel)
        ? r.members.find(n => n !== userNickname)
        : label;
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
  
  
async function joinRoom(roomId) {
  if (socket) socket.close();
  renderedFileIds.clear();
  currentRoom = roomId;

  // readonly для каналов
  const m = roomMeta[roomId] || {};
  const readOnly = m.is_channel && m.creator !== userNickname;
  inputContainer.style.display = readOnly ? 'none' : 'flex';
  readonlyNote  .style.display = readOnly ? 'block' : 'none';
  const callBtn = document.getElementById('call-btn');
  if (m.is_channel) {
    callBtn.style.display = 'none';
  } else {
    callBtn.style.display = ''; 
  }

    // Кнопка "Добавить участников" — только для групп
  const addBtn = document.getElementById('add-member-btn');
  addMemberBtn.style.display = m.is_group ? 'inline-flex' : 'none';
  if (m.is_group) {
    addBtn.style.display = '';
  } else {
    addBtn.style.display = 'none';
  }
  // формируем заголовок
  const header = document.getElementById('chat-header');
  const left   = header.querySelector('.chat-header__left');
  let title;
  if (m.is_channel) {
    title = `Канал: ${m.name || `#${roomId}`}`;
  } else if (m.is_group) {
    title = `Группа: ${m.name || `#${roomId}`}`;
  } else {
    title = `Собеседник: ${currentPeer}`;
  }
  left.textContent = title;
  header.classList.remove('hidden');
  document.getElementById('chat-section').classList.add('active');
  document.getElementById('chat-box').innerHTML = '';


  // Настраиваем WebSocket
  socket = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') +
      location.host
  );
  socket.onopen = () =>
    socket.send(JSON.stringify({ type: 'join', token, roomId }));
 socket.onmessage = ev => {
  const msg = JSON.parse(ev.data);

  // 0) Отфильтровываем события, не относящиеся к текущей комнате
  if (msg.roomId !== currentRoom) return;

  switch (msg.type) {
    case 'webrtc-hangup':
      if (msg.from === userNickname) break; // не обрабатываем эхо

      // 1) Всегда останавливаем WebRTC-потоки и таймер
      if (pc) { pc.close(); pc = null; }
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
      clearInterval(callTimerIntvl);
      clearTimeout(answerTimeout);

      // 2) Рисуем подходящее системное сообщение:
      //    — если разговор уже был начат → finished
      //    — если не был принят → missed
      if (answeredCall) {
        endCall('finished', msg.from, /* sendToServer=*/ false);
      } else {
        endCall('missed', msg.from, /* sendToServer=*/ false);
      }

      answeredCall = false;
      break;



      
    case 'webrtc-cancel':
      // рисуем только если это сделал НЕ мы сами
       if (msg.from !== userNickname) {
    // только рендерим, без второго POST
    endCall('cancelled', msg.from, /*sendToServer*/ false);
  }
      break;

    case 'message':
      // Если у вас есть call_id и вы хотите его передавать в appendMessage:
      appendMessage(
        msg.sender,
        msg.text,
        msg.time,
        msg.call_id ?? null
      );
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
  // Не дублируем свои собственные звонки
  if (msg.initiator === userNickname) break;

  // Формируем и отрисовываем через хелпер
  const fullTextCall = formatCallText({
    initiator: msg.initiator,
    recipient: msg.recipient,
    status:    msg.status,
    duration:  msg.duration || 0,
    time:      msg.ended_at || msg.happened_at
  });
  appendCenterCall(fullTextCall);

  // 2) короткий текст для «пузырька» — только отмена/сброс
  let shortText = null;
  if (msg.status === 'cancelled' && (msg.duration || 0) === 0) {
    shortText = `${msg.initiator} отменил(а) звонок`;
  }
  else if (msg.status === 'cancelled') {
    shortText = `${msg.initiator} сбросил(а) звонок`;
  }

  if (shortText) {
    appendMessage(
      msg.initiator,
      shortText,
      msg.ended_at || msg.time || new Date().toISOString(),
      msg.call_id ?? null
    );
  }
  break;
}



    default:
      console.warn('Unknown message type:', msg.type);
  }
};


  // ─── Загрузка всей истории из одного эндпоинта ───────────────────────────
  const res = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    console.error(await res.text());
    return;
  }
  const history = await res.json();
history.forEach(m => {


  if (m.type === 'call') {
    const fullTextHist = formatCallText({
      initiator: m.initiator,
      recipient: m.recipient,
      status:    m.status,
      duration:  m.duration || 0,
      time:      m.ended_at || m.started_at
    });
    appendCenterCall(fullTextHist);
    return;
  }

  // 3) Файловое сообщение (из таблицы messages + files)
  if (m.type === 'message' && m.file_id !== null) {
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
  if (m.type === 'message' && m.text !== null) {
    appendMessage(
      m.sender_nickname,
      m.text,
      m.time
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
  
// Функция открытия мини-приложения  
function openMiniapp(path) {
  frame.src = path;
  modal.style.display = 'flex';
}

// Привязываем кнопки  
document.getElementById('btn-weather')
  .addEventListener('click', () => openMiniapp('/miniapps/weather/index.html'));

document.getElementById('btn-calendar')
  .addEventListener('click', () => openMiniapp('/miniapps/calendar/index.html'));

// Закрытие модалки  
closeBtn.addEventListener('click', () => {
  modal.style.display = 'none';
  frame.src = '';   // сброс iframe
});

  // Initialization
  loadRooms();
  loadUsers();
});
