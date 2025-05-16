// server/client/chat.js
// Клиентская логика WebRTC и чата, переписанная для хранения звонков через WebSocket

document.addEventListener('DOMContentLoaded', () => {
  const token        = localStorage.getItem('token');
  const userNickname = localStorage.getItem('nickname');
  const renderedFileIds = new Set();

  if (!token || !userNickname) {
    window.location.href = 'index.html';
    return;
  }

  let socket        = null;
  let currentRoom   = null;
  let currentPeer   = null;
  let pc            = null;
  let localStream   = null;
  let callStartTime = null;
  let callTimerIntvl;
  let mediaRecorder;
  let audioChunks   = [];

  const stunConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  // UI elements
  document.getElementById('current-user').textContent = userNickname;
  const textarea    = document.getElementById('message');
  const attachBtn   = document.getElementById('attach-btn');
  const callBtn     = document.getElementById('call-btn');
  const sendBtn     = document.getElementById('send-btn');
  const voiceBtn    = document.getElementById('voice-btn');

  // File input for attachments
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  // Call window elements
  const callWindow  = document.getElementById('call-window');
  const callTitle   = document.getElementById('call-title');
  const callStatus  = document.getElementById('call-status');
  const callTimerEl = document.getElementById('call-timer');
  const answerBtn   = document.getElementById('call-answer');
  const cancelBtn   = document.getElementById('call-cancel');
  const remoteAudio = document.getElementById('remote-audio');

  // Lightbox elements
  const overlay      = document.getElementById('lightbox-overlay');
  const lightboxImg  = document.getElementById('lightbox-image');
  const lbCloseBtn   = document.getElementById('lightbox-close');
  const lbDownloadBtn= document.getElementById('lightbox-download');

  // -------------------
  // Helpers
  // -------------------

  function appendSystem(text) {
    const chatBox = document.getElementById('chat-box');
    const el = document.createElement('div');
    el.className = 'system-message';
    el.textContent = text;
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

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

  function appendMessage(sender, text, time) {
    const chatBox = document.getElementById('chat-box');
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    const msgEl = document.createElement('div');
    msgEl.className = sender === userNickname ? 'my-message' : 'other-message';

    const info = document.createElement('div');
    info.className = 'message-info';
    info.textContent = `${sender} • ${new Date(time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`;

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
      const res = await fetch(`/api/files/${fileId}`);
      if (!res.ok) throw new Error('Fetch error');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
      alert('Не удалось скачать файл');
    }
  }

  async function appendFile(sender, fileId, filename, mimeType, time) {
    if (renderedFileIds.has(fileId)) return;
    renderedFileIds.add(fileId);

    const chatBox = document.getElementById('chat-box');
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    const msgEl = document.createElement('div');
    msgEl.className = sender === userNickname ? 'my-message' : 'other-message';

    const info = document.createElement('div');
    info.className = 'message-info';
    info.textContent = `${sender} • ${new Date(time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble media-bubble';
    msgEl.append(info, bubble);
    wrapper.appendChild(msgEl);
    chatBox.appendChild(wrapper);

    if (mimeType.startsWith('image/')) {
      const img = document.createElement('img');
      img.alt = '';
      img.dataset.src = `/api/files/${fileId}`;
      img.dataset.filename = filename;
      bubble.appendChild(img);
      fetch(img.dataset.src, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.blob() : Promise.reject())
        .then(blob => img.src = URL.createObjectURL(blob))
        .catch(() => img.src = img.dataset.src);

    } else if (mimeType.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = `/api/files/${fileId}`;
      bubble.appendChild(audio);

    } else if (mimeType.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = `/api/files/${fileId}`;
      bubble.appendChild(video);

    } else {
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = `📎 ${filename}`;
      link.onclick = e => { e.preventDefault(); downloadFile(fileId, filename); };
      bubble.appendChild(link);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function autoResize() {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  // -------------------
  // Call UI
  // -------------------

  function showCallWindow(peer, incoming = false) {
    currentPeer = peer;
    callTitle.textContent  = `Звонок с ${peer}`;
    callStatus.textContent = incoming ? 'Входящий звонок' : 'Ожидание ответа';
    callTimerEl.textContent= '00:00';
    answerBtn.style.display= incoming ? 'inline-block' : 'none';
    cancelBtn.textContent  = incoming ? 'Отклонить' : 'Отмена';
    callWindow.classList.remove('hidden');

    callStartTime = Date.now();
    callTimerIntvl = setInterval(() => {
      const sec = Math.floor((Date.now() - callStartTime)/1000);
      const m = String(Math.floor(sec/60)).padStart(2,'0');
      const s = String(sec % 60).padStart(2,'0');
      callTimerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  function hideCallWindow() {
    clearInterval(callTimerIntvl);
    callWindow.classList.add('hidden');
  }

  function sendEndCall(status) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentRoom) return;
    socket.send(JSON.stringify({
      type:       'webrtc-end',
      roomId:     currentRoom,
      initiator:  userNickname,
      recipient:  currentPeer,
      startedAt:  callStartTime,
      endedAt:    Date.now(),
      status
    }));
    hideCallWindow();
  }

  function createPeerConnection() {
    pc = new RTCPeerConnection(stunConfig);

    pc.onicecandidate = e => {
      if (e.candidate && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'webrtc-ice', payload: e.candidate }));
      }
    };

    pc.ontrack = e => {
      const stream = e.streams[0];
      if (!stream) return;
      remoteAudio.srcObject = stream;
      remoteAudio.muted = false;
      remoteAudio.play().catch(() => {});
    };
  }

  async function startCall() {
    createPeerConnection();
    showCallWindow(currentPeer, false);
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.send(JSON.stringify({
        type:    'webrtc-offer',
        from:    userNickname,
        to:      currentPeer,
        payload: offer
      }));
    } catch (err) {
      console.error('Ошибка при старте звонка:', err);
      hideCallWindow();
    }
  }

  answerBtn.onclick = async () => {
    createPeerConnection();
    showCallWindow(currentPeer, true);
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.send(JSON.stringify({ type: 'webrtc-answer', from: userNickname, payload: answer }));
      callStatus.textContent = 'В разговоре';
      answerBtn.style.display = 'none';
    } catch (err) {
      console.error('Ошибка при ответе:', err);
      hideCallWindow();
    }
  };

  cancelBtn.onclick = () => sendEndCall('cancelled');
  callBtn.onclick   = () => socket && socket.readyState === WebSocket.OPEN && startCall();

  // -------------------
  // WebSocket & History
  // -------------------

  async function setupSocket(roomId) {
    if (socket) socket.close();
    renderedFileIds.clear();
    currentRoom = roomId;
    document.getElementById('chat-box').innerHTML = '';

    document.getElementById('chat-peer').textContent = currentPeer;
    document.getElementById('chat-header').classList.remove('hidden');
    document.getElementById('chat-section').classList.add('active');

    socket = new WebSocket((location.protocol==='https:'?'wss://':'ws://') + location.host);
    socket.onopen = () => socket.send(JSON.stringify({ type:'join', token, roomId }));
    socket.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      switch (msg.type) {
        case 'message':      appendMessage(msg.sender, msg.text, msg.time); break;
        case 'file':         appendFile(msg.sender, msg.fileId, msg.filename, msg.mimeType, msg.time); break;
        case 'call':         appendCenterCall(msg.message_text); break;
        case 'webrtc-offer': currentPeer = msg.from; handleOffer(msg.payload); showCallWindow(currentPeer, true); break;
        case 'webrtc-answer':handleAnswer(msg.payload); break;
        case 'webrtc-ice':   handleIce(msg.payload); break;
      }
    };

    // Fetch history
    const [mRes, cRes] = await Promise.all([
      fetch(`/api/rooms/${roomId}/messages`, { headers:{ Authorization:`Bearer ${token}` } }),
      fetch(`/api/rooms/${roomId}/calls`,    { headers:{ Authorization:`Bearer ${token}` } }),
    ]);
    const msgs  = mRes.ok ? await mRes.json() : [];
    const calls = cRes.ok ? await cRes.json() : [];
    const history = [
      ...msgs.map(m => ({ type:'message', sender:m.sender_nickname, text:m.text, time:m.time })),
      ...calls.map(c => ({ type:'call', message_text:c.message_text, time:c.started_at }))
    ].sort((a,b) => new Date(a.time) - new Date(b.time));

    history.forEach(item => {
      if (item.type==='message') appendMessage(item.sender,item.text,item.time);
      else                       appendCenterCall(item.message_text);
    });
  }

  async function handleOffer(o)  { createPeerConnection(); await setRemote(o); }
  async function handleAnswer(a) { if(pc) await pc.setRemoteDescription(a); callStatus.textContent='В разговоре'; }
  async function handleIce(c)    { if(pc) await pc.addIceCandidate(c); }

  async function setRemote(desc) {
    localStream = await navigator.mediaDevices.getUserMedia({ audio:true });
    localStream.getTracks().forEach(t=>pc.addTrack(t, localStream));
    await pc.setRemoteDescription(desc);
  }

  // -------------------
  // Messages & Files UI
  // -------------------

  sendBtn.onclick = () => {
    const text = textarea.value.trim();
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type:'message', token, roomId: currentRoom, text }));
    textarea.value = '';
    autoResize();
  };
  textarea.addEventListener('input', autoResize);
  textarea.addEventListener('keypress', e => { if (e.key==='Enter') { e.preventDefault(); sendBtn.onclick(); } });

  attachBtn.onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    if (!currentRoom) { alert('Сначала выберите чат'); return; }
    const file = fileInput.files[0]; if (!file) return;
    const form = new FormData(); form.append('file', file); form.append('roomId', currentRoom);
    try {
      const res = await fetch('/api/files', { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: form });
      if (!res.ok) throw new Error(await res.text());
      const { fileId, filename, mimeType, time } = await res.json();
      socket.send(JSON.stringify({ type:'file', roomId: currentRoom, sender: userNickname, fileId, filename, mimeType, time }));
    } catch (e) {
      console.error('Ошибка загрузки файла:', e);
    }
    fileInput.value = '';
  };

  voiceBtn.onclick = async () => {
    if (!currentRoom) return alert('Сначала выберите чат');
    if (mediaRecorder && mediaRecorder.state==='recording') {
      mediaRecorder.stop();
      voiceBtn.textContent='🎤';
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e=>{ if(e.data.size) audioChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks,{type:'audio/webm'});
        const file = new File([blob],`voice-${Date.now()}.webm`,{type:blob.type});
        const form = new FormData(); form.append('file', file); form.append('roomId', currentRoom);
        const res = await fetch('/api/files',{ method:'POST', headers:{Authorization:`Bearer ${token}`}, body: form });
        if (!res.ok) console.error('Ошибка загрузки голоса');
      };
      mediaRecorder.start();
      voiceBtn.textContent='■';
    } catch (e) {
      console.error('Нет доступа к микрофону', e);
      alert('Не удалось получить доступ к микрофону');
    }
  };

  // -------------------
  // Rooms & Users
  // -------------------

  async function loadRooms() {
    const res = await fetch('/api/rooms',{ headers:{ Authorization:`Bearer ${token}` } });
    if (!res.ok) return;
    const rooms = await res.json();
    const ul = document.getElementById('rooms-list'); ul.innerHTML = '';
    rooms.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r.is_group ? (r.name||`Группа #${r.id}`) : (r.members.find(n=>n!==userNickname)||'(без имени)');
      li.onclick = () => {
        currentPeer = r.is_group ? (r.name||`Группа #${r.id}`) : r.members.find(n=>n!==userNickname);
        setupSocket(r.id);
      };
      ul.appendChild(li);
    });
  }

  async function loadUsers() {
    const res = await fetch('/api/users',{ headers:{ Authorization:`Bearer ${token}` } });
    if (!res.ok) return;
    const users = await res.json();
    const ul = document.getElementById('users-list'); ul.innerHTML = '';
    users.filter(u=>u.nickname!==userNickname).forEach(u=>{
      const li = document.createElement('li');
      li.textContent = u.nickname;
      li.onclick = () => openPrivateChat(u.nickname);
      ul.appendChild(li);
    });
  }

  async function openPrivateChat(otherNick) {
    currentPeer = otherNick;
    const rr = await fetch('/api/rooms',{ headers:{ Authorization:`Bearer ${token}` } });
    const rooms = rr.ok?await rr.json():[];
    const key = [userNickname, otherNick].sort().join('|');
    const ex = rooms.find(r=> !r.is_group && r.members.sort().join('|')===key);
    if (ex) return setupSocket(ex.id);
    const cr = await fetch('/api/rooms',{ method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ is_group:false,members:[userNickname, otherNick] }) });
    const { roomId } = await cr.json();
    loadRooms();
    setupSocket(roomId);
  }

  // -------------------
  // Init
  // -------------------

  loadRooms();
  loadUsers();
});
