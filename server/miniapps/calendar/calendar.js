// server/miniapps/calendar/calendar.js
(() => {
  // === Таб-навигатор ===
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    };
  });

  // === Звук и разрешения ===
  const audio = new Audio('/miniapps/calendar/notify.mp3');
  audio.preload = 'auto';
  document.body.addEventListener('click', () => {
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
  }, { once: true });
  if ('Notification' in window) {
    Notification.requestPermission().then(p => console.log('Notification permission:', p));
  }

  // === Утилиты ===
  const pad = n => String(n).padStart(2, '0');
  function getLocalDateStr(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }
  function toTimestamp(dateStr, hh, mm) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, hh, mm, 0, 0).getTime();
  }

  // === Авторизация ===
  const token = () => localStorage.getItem('token');

  // === Планирование уведомлений календаря ===
  const notified = new Set();

  function fireEvent(description, timeStr, ts) {
    if (notified.has(ts)) return;
    notified.add(ts);
    audio.play().catch(() => {});
    if (Notification.permission === 'granted') {
      new Notification('Напоминание', {
        body: `${timeStr} — ${description}`,
        icon: '/miniapps/calendar/icon.png',
        tag: String(ts),
        renotify: true,
        requireInteraction: true,
        silent: false
      });
    }
    console.log(`🚀 Fired '${description}' at ${timeStr}`);
  }

  function scheduleEvent(timeStr, description) {
    const dateStr = getLocalDateStr();
    const [hh, mm] = timeStr.split(':').map(Number);
    const ts = toTimestamp(dateStr, hh, mm);
    const delay = ts - Date.now();
    console.log(`Scheduling '${description}' at ${timeStr}, delay=${delay}ms`);
    if (delay > 0) {
      setTimeout(() => fireEvent(description, timeStr, ts), delay);
    } else if (delay >= -1000) {
      setTimeout(() => fireEvent(description, timeStr, ts), 0);
    }
  }

  function scheduleTodaysEvents() {
    const dateStr = getLocalDateStr();
    fetch(`/events?date=${dateStr}`, {
      headers: { 'Authorization': `Bearer ${token()}` }
    })
    .then(res => res.ok ? res.json() : [])
    .then(events => {
      events.forEach(({ time, description }) => {
        if (time) scheduleEvent(time, description);
      });
    })
    .catch(err => console.error('Error scheduling events:', err));
  }

  // === Рендер календаря ===
  const today = new Date();
  let current = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthYearEl = document.getElementById('month-year');
  const grid        = document.getElementById('calendar-grid');
  const prevBtn     = document.getElementById('prev-month');
  const nextBtn     = document.getElementById('next-month');

  async function renderCalendar() {
    grid.innerHTML = '';
    const year  = current.getFullYear();
    const month = current.getMonth() + 1;
    monthYearEl.textContent = current.toLocaleString('ru', { month: 'long', year: 'numeric' });

    const res = await fetch(`/events?year=${year}&month=${month}`, {
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    const eventDates = res.ok ? await res.json() : [];

    const firstDay    = new Date(year, month-1, 1).getDay() || 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 1; i < firstDay; i++) grid.appendChild(document.createElement('div'));
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      cell.textContent = d;
      if (dateStr === getLocalDateStr()) cell.classList.add('today');
      if (eventDates.includes(dateStr))  cell.classList.add('has-event');
      cell.onclick = () => openList(dateStr);
      grid.appendChild(cell);
    }
  }

  // === Оверлей и форма ===
  const listOverlay = document.getElementById('events-list-overlay');
  const listDateEl  = document.getElementById('list-date');
  const listEl      = document.getElementById('events-list');
  const addNewBtn   = document.getElementById('add-new-event');
  const closeList   = document.getElementById('close-list');
  const formOverlay = document.getElementById('event-form');
  const formBack    = formOverlay.querySelector('.form-backdrop');
  const cancelBtn   = document.getElementById('cancel-event');
  const saveBtn     = document.getElementById('save-event');
  const dateInput   = document.getElementById('event-date');
  const timeInput   = document.getElementById('event-time');
  const descInput   = document.getElementById('event-desc');

  async function openList(dateStr) {
    listDateEl.textContent = dateStr;
    const res = await fetch(`/events?date=${dateStr}`, {
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    const items = res.ok ? await res.json() : [];
    listEl.innerHTML = items.length === 0
      ? '<li>Нет событий</li>'
      : items.map(i => `<li><span class="event-time">${i.time||'—'}</span> <span class="event-desc">${i.description}</span></li>`).join('');
    dateInput.value = dateStr;
    listOverlay.classList.remove('hidden');
  }

  closeList.onclick = () => listOverlay.classList.add('hidden');
  addNewBtn.onclick = () => {
    listOverlay.classList.add('hidden');
    timeInput.value = '';
    descInput.value = '';
    formOverlay.classList.remove('hidden');
  };
  saveBtn.onclick = async () => {
    try {
      const body = { date: dateInput.value, time: timeInput.value, desc: descInput.value };
      const res = await fetch('/events', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`Ошибка ${res.status}: ${await res.text()}`);
      formOverlay.classList.add('hidden');
      await renderCalendar();
      if (dateInput.value === getLocalDateStr()) scheduleEvent(timeInput.value, descInput.value);
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };
  cancelBtn.onclick = () => formOverlay.classList.add('hidden');
  formBack.onclick   = () => formOverlay.classList.add('hidden');
  prevBtn.onclick   = () => { current.setMonth(current.getMonth()-1); renderCalendar(); };
  nextBtn.onclick   = () => { current.setMonth(current.getMonth()+1); renderCalendar(); };

  // === Таймер / Секундомер / Будильник ===
  const budAudio     = new Audio('/miniapps/calendar/bud.mp3');
  const modeSelect   = document.getElementById('time-mode');
  const blocks       = {
    stopwatch: document.getElementById('param-stopwatch'),
    countdown: document.getElementById('param-countdown'),
    alarm:     document.getElementById('param-alarm'),
  };
  const display      = document.getElementById('timer-display');
  const startBtn     = document.getElementById('start-time');
  const stopBtn      = document.getElementById('stop-time');
  const resetBtn     = document.getElementById('reset-time');
  let stopwatchInt   = null;
  let countdownInt   = null;
  let alarmTimeout   = null;

  function updateModeUI() {
    const mode = modeSelect.value;
    Object.entries(blocks).forEach(([m, el]) => {
      el.classList.toggle('hidden', m !== mode);
    });
    display.textContent = mode === 'stopwatch' ? '00:00.000' : '00:00';
  }

  modeSelect.addEventListener('change', updateModeUI);
  updateModeUI();

  function notify(title, body) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else {
      Notification.requestPermission().then(p => {
        if (p === 'granted') new Notification(title, { body });
      });
    }
  }

  startBtn.addEventListener('click', () => {
    const mode = modeSelect.value;

    // Секундомер
    if (mode === 'stopwatch') {
      clearInterval(stopwatchInt);
      const start = Date.now();
      stopwatchInt = setInterval(() => {
        const diff = Date.now() - start;
        const ms = diff % 1000;
        const s  = Math.floor(diff / 1000) % 60;
        const m  = Math.floor(diff / 60000);
        display.textContent = `${pad(m)}:${pad(s)}.${String(ms).padStart(3,'0')}`;
      }, 30);
    }

    // Обратный отсчёт
    if (mode === 'countdown') {
      clearInterval(countdownInt);
      const secs = Number(document.getElementById('timer-seconds').value);
      if (isNaN(secs) || secs <= 0) return;
      const endTs = Date.now() + secs * 1000;
      countdownInt = setInterval(() => {
        const rem = endTs - Date.now();
        if (rem <= 0) {
          clearInterval(countdownInt);
          display.textContent = '00:00';
          budAudio.play();
          notify('Таймер', 'Обратный отсчёт завершён');
        } else {
          const s = Math.ceil(rem / 1000);
          display.textContent = `00:${pad(s)}`;
        }
      }, 200);
    }

    // Будильник
    if (mode === 'alarm') {
      clearTimeout(alarmTimeout);
      const timeStr = document.getElementById('alarm-time').value;
      if (!timeStr) return;
      const [hh, mm] = timeStr.split(':').map(Number);
      const now = new Date();
      let alarmTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0).getTime();
      if (alarmTs <= Date.now()) alarmTs += 24 * 60 * 60 * 1000;
      alarmTimeout = setTimeout(() => {
        budAudio.play();
        notify('Будильник', `Время: ${timeStr}`);
      }, alarmTs - Date.now());
    }
  });

  stopBtn.addEventListener('click', () => {
    clearInterval(stopwatchInt);
    clearInterval(countdownInt);
    clearTimeout(alarmTimeout);
  });

  resetBtn.addEventListener('click', () => {
    clearInterval(stopwatchInt);
    clearInterval(countdownInt);
    clearTimeout(alarmTimeout);
    display.textContent = modeSelect.value === 'stopwatch' ? '00:00.000' : '00:00';
  });

  // === Инициализация ===
  (async () => {
    await renderCalendar();
    scheduleTodaysEvents();
  })();
})();
