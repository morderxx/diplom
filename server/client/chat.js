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

  function initWebSocket() {
  socket = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') +
      location.host
  );
    
    socket.onopen = () => {
      console.log("WebSocket подключен!");
       socket.send(JSON.stringify({
        type:   'join',
        token:  token,      // ваш JWT
        roomId: null        // или 0, как вам удобнее
      }));
      // Если уже выбрали комнату - присоединяемся
      if (currentRoom) {
        socket.send(JSON.stringify({ type: 'join', token, roomId: currentRoom }));
      }
    };

  socket.onmessage = ev => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return; // не JSON — игнорируем
    }

    // 1) Всегда ловим и обрабатываем roomsUpdated:
    if (msg.type === 'roomsUpdated') {
      loadRooms();    // обновляем список чатов/групп/каналов
      return;
    }

    // 2) Только потом — сообщения для текущей комнаты
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

    case 'roomsUpdated':
      // при любом таком сигнале подгружаем свежие previews
      loadRooms();
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


  socket.onclose = () => {
    // при обрыве — пытаемся переподключиться через секунду
    setTimeout(initWebSocket, 1000);
  };
}

// Вызываем сразу после определения initWebSocket
initWebSocket();
  // Контекстное меню
const contextMenu = document.createElement('div');
contextMenu.className = 'context-menu';
contextMenu.innerHTML = `
  <ul>
    <li id="ctx-delete">Удалить чат</li>
    <li id="ctx-leave">Покинуть</li>
  </ul>
`;
document.body.appendChild(contextMenu);

// Закрытие меню при клике вне его
document.addEventListener('click', () => {
  contextMenu.style.display = 'none';
});
// ─── Планировщик уведомлений календаря ───────────────────────────
;(function(){
  const pad = n => String(n).padStart(2, '0');
  
  // Хранилище для таймеров
  const scheduledTimers = new Map();
  
  function getLocalDateStr(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  
function toTimestamp(dateStr, hh, mm) {
  // Исправляем формат даты, если пришло с временной зоной
  const cleanDateStr = dateStr.split('T')[0];
  const [y, m, day] = cleanDateStr.split('-').map(Number);
  
  // Создаем дату в локальном времени
  const date = new Date(y, m-1, day, hh, mm);
  return date.getTime();
}
  
  const calendarToken = () => localStorage.getItem('token');
  const notifAudio = new Audio('/miniapps/calendar/notify.mp3');
  notifAudio.preload = 'auto';

  // Инициализация аудио
  document.body.addEventListener('click', () => {
    notifAudio.play().then(() => {
      notifAudio.pause();
      notifAudio.currentTime = 0;
    }).catch(() => {});
  }, { once: true });

  if ('Notification' in window) {
    Notification.requestPermission();
  }

  // Очистка старых таймеров
  function clearExistingTimers() {
    for (const timerId of scheduledTimers.values()) {
      clearTimeout(timerId);
    }
    scheduledTimers.clear();
  }

  
  
function scrollToBottom() {
  const chatBox = document.getElementById('chat-box');
  // Два варианта прокрутки для надежности
  chatBox.scrollTop = chatBox.scrollHeight;
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 50);
}
  
function scheduleNotification(dateStr, time, description) {
  if (!time) return; // Пропускаем события без времени

    const parts = time.split(':');
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
    // Добавляем валидацию времени
if (isNaN(hh) || hh < 0 || hh > 23 || isNaN(mm) || mm < 0 || mm > 59) {
    console.error(`Некорректное время: ${time}`);
    return;
  }
  const eventTime = toTimestamp(dateStr, hh, mm);
  const now = Date.now();
  const delay = eventTime - now;

  // В scheduleNotification
if (isNaN(hh) || isNaN(mm)) {
  console.error(`Некорректное время: ${time}`);
  return;
}
  // Пропускаем прошедшие события
  if (delay < 0) {
    console.log(`Пропущено прошедшее событие: ${dateStr} ${time}`);
    return;
  }

  // Удаляем старый таймер, если существует
  const key = `${dateStr}|${time}`;
  if (scheduledTimers.has(key)) {
    clearTimeout(scheduledTimers.get(key));
    scheduledTimers.delete(key);
  }

  const timerId = setTimeout(() => {
    notifAudio.play().catch(() => {});
    
    if (Notification.permission === 'granted') {
      new Notification('Напоминание', {
        body: `${time} — ${description}`,
        icon: '/miniapps/calendar/icon.png'
      });
    }
    
    scheduledTimers.delete(key);
  }, delay);

  scheduledTimers.set(key, timerId);
}

  // Основная функция проверки и планирования
async function checkAndSchedule() {
  clearExistingTimers();
  
  try {
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + 30);
    
    const dateRange = `?start=${getLocalDateStr(today)}&end=${getLocalDateStr(future)}`;
    const r = await fetch(`/events${dateRange}`, {
      headers: { 'Authorization': `Bearer ${calendarToken()}` }
    });
    
    if (!r.ok) return;
    
    const events = await r.json();
    
    for (const event of events) {
      if (event.time && event.description) {
        console.log(`Планируем: ${event.date} ${event.time}`);
        scheduleNotification(event.date, event.time, event.description);
      }
    }
  } catch(e) {
    console.error('Ошибка при загрузке событий:', e);
  }
}

  // Запускаем сразу и затем каждые 5 минут
  checkAndSchedule();
  setInterval(checkAndSchedule, 300_000); // 5 минут
  
  // Обновляем расписание при событиях из iframe календаря
  window.addEventListener('message', (event) => {
    if (event.data === 'calendarUpdated') {
      checkAndSchedule();
    }
  });
})();


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
     // Добавим в начало, рядом с другими DOM элементами
  const globalSearch = document.getElementById('global-search');
  const searchResults = document.getElementById('search-results');
  const usersList = document.getElementById('users-list');

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
const gameModal = document.getElementById('game-modal');
const gameFrame = document.getElementById('game-frame');
const closeGameBtn = document.querySelector('.close-game');
// Храним полный список пользователей (никнеймы) и выбранных
let allUsers = [];
const selectedUsers = new Set();

  // Загрузка всех пользователей (включая администратора)
async function loadAllUsersWithAdmin() {
  try {
    const res = await fetch(`${API_URL}/users/all`, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    if (!res.ok) throw new Error('Cannot load users');
    const users = await res.json();
    return users.map(u => u.nickname);
  } catch (err) {
    console.error('Error loading users with admin:', err);
    return [];
  }
}

// Загрузка пользователей для подсказок (без администратора)
async function loadRegularUsers() {
  try {
    const res = await fetch(`${API_URL}/users`, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    if (!res.ok) throw new Error('Cannot load users');
    const users = await res.json();
    return users.map(u => u.nickname);
  } catch (err) {
    console.error('Error loading regular users:', err);
    return [];
  }
}
// Загрузка всех пользователей один раз
// Загрузка пользователей для подсказок
async function loadAllUsers() {
  try {
    // Основной список пользователей (без администратора)
    const res = await fetch(`${API_URL}/users`, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    
    if (!res.ok) throw new Error('Cannot load users');
    const users = await res.json();
    allUsers = users.map(u => u.nickname);
    
    // Добавляем администратора для чата техподдержки
    if (!allUsers.includes('@admin')) {
      allUsers.push('@admin');
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
}
loadAllUsers();

// Открыть модалку
createGroupBtn.onclick = () => {
  document.querySelector('#group-modal h3').textContent = 'Новая группа';
  groupNameInput.placeholder = 'Введите название группы';
  groupModal.dataset.mode = 'create';
  groupModal.dataset.roomType = 'group';

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
    const inputValue = inputEl.value;
    // Проверяем что значение существует перед обработкой
    const q = inputValue ? inputValue.trim().toLowerCase() : '';
    
    suggestionsEl.innerHTML = '';
    if (!q) return;
    
    // Фильтрация с проверкой на null
    const matches = allUsers
      .filter(n => n && n.toLowerCase().includes(q) && !selectedSet.has(n))
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

createChannelBtn.onclick = () => {
  document.querySelector('#group-modal h3').textContent = 'Новый канал';
  groupNameInput.placeholder = 'Введите название канала';
  groupModal.dataset.mode = 'create';
  groupModal.dataset.roomType = 'channel';

  groupModal.classList.remove('hidden');
  userSearchInput.value = '';
  suggestionsList.innerHTML = '';
  selectedUsers.clear();
  renderSelectedUsers();
  userSearchInput.focus();
};


createGroupBtn2.onclick = async () => {
  const mode = groupModal.dataset.mode;
  const roomType = groupModal.dataset.roomType;
  const name = groupNameInput.value.trim();
  const members = Array.from(selectedUsers);

  if (mode === 'create') {
    const isChannel = roomType === 'channel';
    
    if (!name) {
      return alert(isChannel ? 'Укажите название канала' : 'Укажите название группы');
    }
    if (members.length === 0) {
      return alert('Добавьте хотя бы одного участника');
    }

    // Добавляем текущего пользователя
    members.push(userNickname);

    const payload = {
      is_group: !isChannel,
      is_channel: isChannel,
      name,
      members
    };

    try {
      const res = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error(await res.text());
      
      const data = await res.json();
      groupModal.classList.add('hidden');
      await loadRooms();
      joinRoom(data.roomId);
      
    } catch (err) {
      console.error(err);
      alert(`Не удалось создать ${isChannel ? 'канал' : 'группу'}: ${err.message}`);
    }
  } else if (mode === 'add') {
    if (members.length === 0) {
      return alert('Выберите хотя бы одного участника');
    }

    try {
      const res = await fetch(`${API_URL}/rooms/${currentRoom}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
  setTimeout(scrollToBottom, 0);
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
        if (!fileId) {
    console.error('Server returned invalid file ID');
    return;
  }
            appendFile(
        userNickname, // отправитель
        fileId,
        filename,
        mimeType,
        time
      );
 // 1. Немедленно обновляем сайдбар для текущего пользователя
      loadRooms();
      
      // 2. Отправляем специальное событие для обновления сайдбара
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: 'forceRoomsUpdate',
          roomId: currentRoom,
          isImage: true
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
         if (res.ok) {
          const { fileId, filename, mimeType, time } = await res.json();
          
          // Добавляем голосовое сообщение в интерфейс
          appendFile(
            userNickname,
            fileId,
            filename,
            mimeType,
            time
          );
          socket.send(JSON.stringify({
            type: 'file',
            roomId: currentRoom,
            fileId:   fileId,
            fileId: fileId,
            filename: filename,
            mimeType: 'audio/webm', // или другой MIME-тип
            time: time
          }));
        }
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
  // 1. Забираем список чатов с последним сообщением и временем
  const res = await fetch(`${API_URL}/rooms`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    console.error(await res.text());
    return;
  }
  let rooms = await res.json();

  // 2. Сортируем по времени последнего сообщения (последние наверху)
  rooms.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));

  // 3. Обновляем мета-информацию (ваш старый код)
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

  // 4. Рендерим список
  const ul = document.getElementById('rooms-list');
  ul.innerHTML = '';

rooms.forEach(r => {
    const li = document.createElement('li');
    li.dataset.id = r.id;

    // 1) Заголовок
    const title = r.is_channel
      ? (r.name || `Канал #${r.id}`)
      : r.is_group
        ? (r.name || `Группа #${r.id}`)
        : (r.members.find(n => n !== userNickname) || '(без имени)');

    // 2) Время
    const time = r.last_message_time
      ? new Date(r.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    // 3) Превью + никнейм по условию (ИЗМЕНЕНО)
    let previewText;
    
   if (r.last_message_file_id) {
    // Файловое сообщение
    if (r.last_message_file_type) {
        if (r.last_message_file_type.startsWith('audio/')) {
            previewText = '🎤 Голосовое сообщение';
        } 
        else if (r.last_message_file_type.startsWith('image/')) {
            previewText = '🖼️ Фото';  // Иконка фото + текст
        }
        else if (r.last_message_file_type.startsWith('video/')) {
            previewText = '🎬 Видео';
        }
        else {
            previewText = '📎 Файл';  // Для всех остальных типов
        }
    } else {
        previewText = '📎 Файл';  // На случай если тип неизвестен
    }
} else {
        // Текстовое сообщение
        previewText = r.last_message_text
            ? (r.last_message_text.length > 30
                ? r.last_message_text.slice(0, 27) + '…'
                : r.last_message_text)
            : '— нет сообщений —';
    }

    // Добавляем отправителя для не-каналов
    if (!r.is_channel && r.last_message_sender && r.last_message_sender !== userNickname) {
        previewText = `<span class="preview-sender">${r.last_message_sender}:</span> ${previewText}`;
    }

    // 4) Собираем HTML (только title, preview, time)
    li.innerHTML = `
      <div class="room-title">${title}</div>
      <div class="room-preview">${previewText}</div>
      <div class="room-time">${time}</div>
    `;

    li.onclick = () => {
        currentPeer = (!r.is_group && !r.is_channel)
            ? r.members.find(n => n !== userNickname)
            : title;
        joinRoom(r.id);
    };

    ul.appendChild(li);
});



  // 5. Кнопка техподдержки, если её ещё нет
  const hasSupport = rooms.some(r =>
    !r.is_group && !r.is_channel && r.members.includes('@admin')
  );
  if (!hasSupport) {
    const li = document.createElement('li');
    li.classList.add('support-room');
    li.innerHTML = `<div class="room-title">Техподдержка</div>`;
    li.onclick = () => openPrivateChat('@admin');
    ul.appendChild(li);
  }
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
  renderedFileIds.clear();
  currentRoom = roomId;

  if (!roomMeta[roomId]) {
    console.error('Канал не найден в roomMeta');
    return;
  }

  // --- UI: readonly, кнопки, заголовок ---
  const m = roomMeta[roomId];
  const readOnly = m.is_channel && m.creator !== userNickname;
  inputContainer.style.display   = readOnly ? 'none' : 'flex';
  readonlyNote.style.display     = readOnly ? 'block' : 'none';
  document.getElementById('call-btn').style.display =
    m.is_channel ? 'none' : '';
  document.getElementById('add-member-btn').style.display =
    m.is_group ? '' : 'none';

  const header = document.getElementById('chat-header');
  const left   = header.querySelector('.chat-header__left');
  let title;
  if (m.is_channel)      title = 'Канал: ' + (m.name || ('#' + roomId));
  else if (m.is_group)   title = 'Группа: ' + (m.name || ('#' + roomId));
  else                   title = 'Собеседник: ' + currentPeer;
  left.textContent = title;
  header.classList.remove('hidden');
  document.getElementById('chat-section').classList.add('active');
  document.getElementById('chat-box').innerHTML = '';

  // отправляем join-сообщение серверу
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'join', token, roomId }));
  }

  // ─── Загрузка истории сообщений ───────────────────────────────────────────
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
    } else if (m.type === 'message' && m.file_id !== null) {
      appendFile(
        m.sender_nickname,
        m.file_id,
        m.filename,
        m.mime_type,
        m.time
      );
    } else if (m.type === 'message' && m.text !== null) {
      appendMessage(
        m.sender_nickname,
        m.text,
        m.time
      );
    } else {
      console.warn('Неизвестный элемент истории:', m);
    }
  });
   setTimeout(() => {
    scrollToBottom();
    // Дополнительная прокрутка через 100 мс для изображений
    setTimeout(scrollToBottom, 100);
  }, 0);
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

    if (sender === '@admin') {
    const el = document.createElement('div');
    el.className = 'admin-message';
    el.innerHTML = `
      <div class="admin-header">Техподдержка</div>
      <div class="admin-text">${text}</div>
      <div class="admin-time">${new Date(time).toLocaleTimeString()}</div>
    `;
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
    if (typeof fileId === 'undefined' || fileId === null) {
    console.error('Invalid fileId received:', {sender, fileId, filename});
    return;
  }
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

     // 1. Немедленно обновляем сайдбар для текущего пользователя
      loadRooms();
      
      // 2. Отправляем специальное событие для обновления сайдбара
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: 'forceRoomsUpdate',
          roomId: currentRoom,
          isImage: true
        }));
      }
     setTimeout(scrollToBottom, 0);
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
   if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'file',
       token,   
      roomId: currentRoom,
      fileId,
      filename,
      mimeType,
      time
    }));
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
  // Если уже открыт другой путь — можно очистить
  if (frame.src && !frame.src.endsWith(path)) {
    frame.src = '';            // выгружаем предыдущий
  }
  frame.src = path;
  modal.style.display = 'flex';
}


// Привязываем кнопки  
document.getElementById('btn-weather')
  .addEventListener('click', () => openMiniapp('/miniapps/weather/index.html'));

document.getElementById('btn-calendar')
  .addEventListener('click', () => openMiniapp('/miniapps/calendar/index.html'));

document.getElementById('btn-finance')
  .addEventListener('click', () => openMiniapp('/miniapps/finance/index.html'));
  
// Закрытие модалки  
closeBtn.addEventListener('click', () => {
  modal.style.display = 'none';
  // НЕ трогаем frame.src — iframe остаётся загруженным, и код календаря продолжает работать
});

// Функция открытия игры
function openGame(path) {
  // Если уже открыта другая игра - очищаем
  if (gameFrame.src && !gameFrame.src.endsWith(path)) {
    gameFrame.src = '';
  }
  
  gameFrame.src = path;
  gameModal.style.display = 'flex';
  
  // Блокируем скролл основного контента
  document.body.style.overflow = 'hidden';

  gameFrame.onload = () => {
    // задержка, чтобы браузер точно успел вставить iframe в DOM
    setTimeout(() => gameFrame.focus(), 50);
  };
}

// Закрытие игрового модального окна
closeGameBtn.addEventListener('click', () => {
  gameModal.style.display = 'none';
  gameFrame.src = '';
  document.body.style.overflow = '';
});

// Закрытие при клике вне окна
window.addEventListener('click', (event) => {
  if (event.target === gameModal) {
    gameModal.style.display = 'none';
    gameFrame.src = '';
    document.body.style.overflow = '';
  }
});

// Привязываем кнопку запуска игры
document.getElementById('btn-strike-game')
  .addEventListener('click', () => openGame('/miniapps/strikegame/index.html'));
document.getElementById('btn-match3-game')
  .addEventListener('click', () => openGame('/miniapps/match3/index.html'));
document.getElementById('btn-runner-game')
  .addEventListener('click', () => openGame('/miniapps/runner/index.html'));



// Новая функция для поиска
async function searchUsersAndChannels(query) {
  if (!query) {
    searchResults.style.display = 'none';
    usersList.style.display = 'block';
    return;
  }

  const isUserSearch = query.startsWith('@');
  const isChannelSearch = query.startsWith('&');
  const searchTerm = query.slice(1).toLowerCase();

  if (!isUserSearch && !isChannelSearch) {
    searchResults.style.display = 'none';
    usersList.style.display = 'block';
    return;
  }

  try {
       const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(searchTerm)}&type=${
      isUserSearch ? 'user' : 'channel'
    }`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(await res.text());
    
    const results = await res.json();
    renderSearchResults(results, isUserSearch ? 'user' : 'channel');
    
  } catch (err) {
    console.error('Search error:', err);
    searchResults.innerHTML = '<li>Ошибка поиска</li>';
  }
}

// Функция отображения результатов поиска
function renderSearchResults(results, type) {
  searchResults.innerHTML = '';
  
  if (results.length === 0) {
    searchResults.innerHTML = '<li>Ничего не найдено</li>';
    searchResults.style.display = 'block';
    usersList.style.display = 'none';
    return;
  }

  results.forEach(item => {
    const li = document.createElement('li');
    li.textContent = type === 'user' ? item.nickname : item.name;
    
// Изменяем обработчик клика в поиске
li.onclick = async () => {
  if (type === 'user') {
    openPrivateChat(item.nickname);
  } else {
    try {
      // Проверяем информацию о канале
      const roomInfo = await fetch(`${API_URL}/rooms/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!roomInfo.ok) throw new Error('Failed to fetch room info');
      const roomData = await roomInfo.json();

      if (!roomData.is_channel) {
        throw new Error('This is not a channel');
      }

      // Отправляем запрос на добавление ТОЛЬКО СЕБЯ
      const res = await fetch(`${API_URL}/rooms/${item.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ members: [userNickname] }) // Только текущий пользователь
      });

      if (!res.ok) throw new Error(await res.text());

      // Обновляем список чатов
      await loadRooms();
      await joinRoom(item.id);
    } catch (err) {
      console.error('Ошибка добавления в канал:', err);
      alert('Не удалось присоединиться к каналу: ' + err.message);
      return;
    }
  }
  globalSearch.value = '';
  searchResults.style.display = 'none';
  usersList.style.display = 'block';
};
    
    searchResults.appendChild(li);
  });

  searchResults.style.display = 'block';
  usersList.style.display = 'none';
}

// Обработчик ввода в поле поиска
globalSearch.addEventListener('input', () => {
  const query = globalSearch.value.trim();
  searchUsersAndChannels(query);
});

// Обработчик клика вне поля поиска
document.addEventListener('click', (e) => {
  if (!globalSearch.contains(e.target) && !searchResults.contains(e.target)) {
    searchResults.style.display = 'none';
    usersList.style.display = 'block';
  }
});

// Обработчик ПКМ для элементов списка чатов
// Обработчик контекстного меню
document.getElementById('rooms-list').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  
  const roomItem = e.target.closest('li');
  if (!roomItem) return;
  
  const roomId = roomItem.dataset.id;
  const roomInfo = roomMeta[roomId];
  if (!roomInfo) return;
  
  // Позиционируем меню
  contextMenu.style.display = 'block';
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;
  
  // Настраиваем видимость пунктов меню
  const isCreator = roomInfo.creator === userNickname;
  
  // Скрываем все пункты меню
  const ctxDelete = document.getElementById('ctx-delete');
  const ctxLeave = document.getElementById('ctx-leave');
  
  ctxDelete.style.display = 'none';
  ctxLeave.style.display = 'none';
  
  // Обновляем текст в зависимости от типа
  if (roomInfo.is_channel) {
    ctxDelete.textContent = 'Удалить канал';
  } else if (roomInfo.is_group) {
    ctxDelete.textContent = 'Удалить группу';
  } else {
    ctxDelete.textContent = 'Удалить чат';
  }
  
  // Для приватных чатов
  if (!roomInfo.is_group && !roomInfo.is_channel) {
    ctxDelete.style.display = 'block';
  } 
  // Для групп и каналов
  else {
    if (isCreator) {
      ctxDelete.style.display = 'block';
    } else {
      ctxLeave.style.display = 'block';
    }
  }
  
  contextMenu.dataset.roomId = roomId;
});

document.getElementById('ctx-delete').addEventListener('click', async () => {
  const roomId = contextMenu.dataset.roomId;
  const roomInfo = roomMeta[roomId];
  
  try {
    const res = await fetch(`${API_URL}/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    await loadRooms();
    
    if (currentRoom === roomId) {
      document.getElementById('chat-section').classList.remove('active');
      currentRoom = null;
      document.getElementById('chat-box').innerHTML = '';
      document.getElementById('chat-header').classList.add('hidden');
    }
  } catch (err) {
    console.error('Ошибка удаления:', err);
    
    let roomType = 'чат';
    if (roomInfo) {
      if (roomInfo.is_channel) roomType = 'канал';
      else if (roomInfo.is_group) roomType = 'группу';
    }
    
    alert(`Не удалось удалить ${roomType}: ${err.message}`);
  }
  
  contextMenu.style.display = 'none';
});

document.getElementById('ctx-leave').addEventListener('click', async () => {
  const roomId = contextMenu.dataset.roomId;
  try {
    const res = await fetch(`${API_URL}/rooms/${roomId}/members/${userNickname}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await res.text());
    await loadRooms();
    if (currentRoom === roomId) {
      document.getElementById('chat-section').classList.remove('active');
      currentRoom = null;
      // Очищаем чат и скрываем элементы интерфейса
      document.getElementById('chat-box').innerHTML = '';
      document.getElementById('chat-header').classList.add('hidden');
    }
  } catch (err) {
    console.error('Ошибка выхода из комнаты:', err);
    alert('Не удалось покинуть комнату');
  }
  contextMenu.style.display = 'none';
});

// Добавить константы для элементов настроек
const settingsModal = document.getElementById('settings-modal');
const settingsForm = document.getElementById('settings-form');
const settingsNickname = document.getElementById('settings-nickname');
const settingsBio = document.getElementById('settings-bio');
const settingsBirthdate = document.getElementById('settings-birthdate');
const settingsCancel = document.getElementById('settings-cancel');
const settingsClose = document.getElementById('settings-close');
const btnSettings = document.getElementById('btn-settings');

// Инициализация настроек
btnSettings.addEventListener('click', openSettingsModal);

async function openSettingsModal() {
  try {
    const res = await fetch(`${API_URL}/users/user/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Failed to load profile');
    
    const profile = await res.json();
    settingsNickname.value = profile.nickname || userNickname;
    settingsBio.value = profile.bio || '';
    settingsBirthdate.value = profile.birthdate || '';
    
    settingsModal.style.display = 'flex';
  } catch (err) {
    console.error('Profile load error:', err);
    alert('Не удалось загрузить настройки профиля');
  }
}

// Обработка сохранения настроек
settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nickname = settingsNickname.value.trim();
  const bio = settingsBio.value.trim();
  const birthdate = settingsBirthdate.value;
  
  try {
    const res = await fetch(`${API_URL}/users/user/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ nickname, bio, birthdate })
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    // Обновляем локальные данные
    if (nickname && nickname !== userNickname) {
      localStorage.setItem('nickname', nickname);
      document.getElementById('current-user').textContent = nickname;
      userNickname = nickname;
    }
    localStorage.setItem('darkTheme', themeToggle.checked);
    
    settingsModal.style.display = 'none';
    alert('Настройки сохранены!');
  } catch (err) {
    console.error('Profile save error:', err);
    alert('Не удалось сохранить настройки: ' + err.message);
  }
});

// Закрытие модалки
settingsClose.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

settingsCancel.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

  // Добавьте этот код вместо текущей реализации темы
const themeToggle = document.getElementById('theme-toggle');

// Инициализация темы
document.addEventListener('DOMContentLoaded', () => {
  const isDark = localStorage.getItem('darkTheme') === 'true';
  themeToggle.checked = isDark;
  applyDarkTheme(isDark);
});

// Обработчик переключателя
themeToggle.addEventListener('change', () => {
  const isDark = themeToggle.checked;
  applyDarkTheme(isDark);
  localStorage.setItem('darkTheme', isDark);
});

// Функция применения темы
function applyDarkTheme(enable) {
  if (enable) {
    // Создаем стили для темной темы
    const style = document.createElement('style');
    style.id = 'dark-theme-styles';
    style.textContent = `
      body.dark-theme {
        filter: invert(1) hue-rotate(180deg) brightness(0.85);
        background-color: #121212 !important;
      }
      
      body.dark-theme img,
      body.dark-theme video,
      body.dark-theme iframe,
      body.dark-theme canvas {
        filter: invert(1) hue-rotate(180deg) brightness(1.2) !important;
      }
      
      body.dark-theme::before {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: #121212;
        z-index: 9999;
        pointer-events: none;
        mix-blend-mode: difference;
        opacity: 0.15;
      }
    `;
    document.head.appendChild(style);
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
    const styles = document.getElementById('dark-theme-styles');
    if (styles) styles.remove();
  }
}

  // В конце файла, в разделе Initialization
document.getElementById('btn-logout').addEventListener('click', logoutUser);

// Новая функция для выхода
async function logoutUser() {
  try {
    // Отправляем запрос на сервер для инвалидации токена
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    console.error('Logout error:', e);
  } finally {
    // Очищаем локальные данные
    localStorage.removeItem('token');
    localStorage.removeItem('nickname');
    
    // Перенаправляем на страницу входа
    window.location.href = 'index.html';
  }
}

        // Получаем все заголовки секций
      const sectionHeaders = document.querySelectorAll('.section-header');
      
      // Добавляем обработчики кликов
      sectionHeaders.forEach(header => {
        header.addEventListener('click', () => {
          const content = header.nextElementSibling;
          header.classList.toggle('expanded');
          content.classList.toggle('expanded');
        });
      });

      // Устанавливаем текущего пользователя
      const currentUser = userNickname;
      document.getElementById('current-user').textContent = currentUser;
      
      // Генерация аватара из первой буквы
      const avatar = userNickname;
      if (avatar) {
        avatar.textContent = currentUser.charAt(0).toUpperCase();
      }
  // Initialization
  loadRooms();
});
