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
  let mediaRecorder;
  let audioChunks    = [];
  let pc             = null;
  let callStartTime  = null;
  let callTimerIntvl = null;

  const stunConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  // UI elements
  document.getElementById('current-user').textContent = userNickname;
  const textarea   = document.getElementById('message');
  const voiceBtn   = document.getElementById('voice-btn');
  const callBtn    = document.getElementById('call-btn');
  const fileInput  = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

  // Call window elements (assumes <div id="call-window"> exists in HTML)
  const callWindow   = document.getElementById('call-window');
  const callTitle    = document.getElementById('call-title');
  const callStatus   = document.getElementById('call-status');
  const callTimerEl  = document.getElementById('call-timer');
  const callMinBtn   = document.getElementById('call-minimize');
  const callCloseBtn = document.getElementById('call-close');
  const remoteAudio  = document.getElementById('remote-audio');

  // Lightbox elements (assumes overlay exists in HTML)
  const overlay      = document.getElementById('lightbox-overlay');
  const lightboxImg  = document.getElementById('lightbox-image');
  const btnClose     = document.getElementById('lightbox-close');
  const btnDownload  = document.getElementById('lightbox-download');

  // Auto-resize textarea
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  // File attach
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

  // Voice recording
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

  // Show/hide call window
  function showCallWindow(peerName) {
    callTitle.textContent = `Звонок с ${peerName}`;
    callStatus.textContent = 'Ожидание ответа...';
    callTimerEl.textContent = '00:00';
    callWindow.classList.remove('hidden');
    callStartTime = Date.now();
    callTimerIntvl = setInterval(() => {
      const sec = Math.floor((Date.now() - callStartTime) / 1000);
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      callTimerEl.textContent = `${m}:${s}`;
    }, 1000);
  }
  function hideCallWindow() {
    callWindow.classList.add('hidden');
    clearInterval(callTimerIntvl);
  }
  function appendSystemMessage(text) {
    const chatBox = document.getElementById('chat-box');
    const el = document.createElement('div');
    el.className = 'system-message';
    el.textContent = text;
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  callMinBtn.onclick = () => { callWindow.style.display = 'none'; };
  callCloseBtn.onclick = () => {
    if (pc) pc.close();
    pc = null;
    appendSystemMessage(`Звонок завершён. Длительность: ${callTimerEl.textContent}`);
    hideCallWindow();
  };

  // WebRTC setup
  function createPeerConnection() {
    pc = new RTCPeerConnection(stunConfig);
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'webrtc-ice', payload: candidate }));
      }
    };
    pc.ontrack = ev => {
      remoteAudio.srcObject = ev.streams[0];
    };
  }
  async function startCall() {
    if (pc) return;
    showCallWindow('собеседником');
    createPeerConnection();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: 'webrtc-offer', payload: offer }));
  }
  async function handleOffer(offer) {
    showCallWindow('собеседником');
    createPeerConnection();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.send(JSON.stringify({ type: 'webrtc-answer', payload: answer }));
  }
  async function handleAnswer(answer) {
    if (pc) await pc.setRemoteDescription(answer);
  }
  async function handleIce(candidate) {
    if (pc) await pc.addIceCandidate(candidate);
  }
  callBtn.onclick = () => {
    if (socket && socket.readyState === WebSocket.OPEN) startCall();
  };

  // Drag call window
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

  // Lightbox handlers
  if (overlay && lightboxImg && btnClose && btnDownload) {
    document.getElementById('chat-box').addEventListener('click', e => {
      if (e.target.tagName === 'IMG' && e.target.src.includes('/api/files/')) {
        lightboxImg.src          = e.target.src;
        overlay.dataset.url      = e.target.src;
        const parts              = e.target.src.split('/');
        overlay.dataset.filename = decodeURIComponent(parts.pop());
        overlay.classList.remove('hidden');
      }
    });
    btnClose.onclick = () => {
      overlay.classList.add('hidden');
      lightboxImg.src = '';
    };
    btnDownload.onclick = () => {
      const url = overlay.dataset.url;
      const filename = overlay.dataset.filename;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    overlay.addEventListener('click', e => {
      if (e.target === overlay) btnClose.click();
    });
  }

  // Load rooms
  async function loadRooms() {
    const res = await fetch(`${API_URL}/rooms`, {
      headers: { Authorization: `Bearer ${token}` }
    });
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

  // Load users
  async function loadUsers() {
    const res = await fetch(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` }
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

  // Open private chat
  async function openPrivateChat(otherNick) {
    const rr = await fetch(`${API_URL}/rooms`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const rooms = rr.ok ? await rr.json() : [];
    const key = [userNickname, otherNick].sort().join('|');
    const ex = rooms.find(r =>
      !r.is_group &&
      r.members.sort().join('|') === key
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

  // Join room + WebSocket + history
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
      } else if (msg.type === 'webrtc-offer') {
        handleOffer(msg.payload);
      } else if (msg.type === 'webrtc-answer') {
        handleAnswer(msg.payload);
      } else if (msg.type === 'webrtc-ice') {
        handleIce(msg.payload);
      }
    };

    const histRes = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
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

  // Render text message
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

  // Download file helper
  async function downloadFile(fileId, filename) {
    try {
      const res = await fetch(`${API_URL}/files/${fileId}`);
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

  // Render file message
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

  // Send text message
  function sendMessage() {
    const text = textarea.value.trim();
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'message', token, roomId: currentRoom, text }));
    textarea.value = '';
  }
  document.getElementById('send-btn').onclick = sendMessage;
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
