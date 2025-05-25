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
  const notifyAudio = new Audio('/miniapps/calendar/notify.mp3');
  notifyAudio.preload = 'auto';
  document.body.addEventListener('click', () => {
    notifyAudio.play().then(() => { notifyAudio.pause(); notifyAudio.currentTime = 0; }).catch(() => {});
  }, { once: true });
  if ('Notification' in window) {
    Notification.requestPermission();
  }

  // === Утилиты ===
  const pad = n => String(n).padStart(2, '0');
  function getLocalDateStr(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function toTimestamp(dateStr, hh, mm) {
    const [y, m, day] = dateStr.split('-').map(Number);
    return new Date(y, m-1, day, hh, mm, 0).getTime();
  }

  // === Авторизация ===
  const token = () => localStorage.getItem('token');

  // === Планирование календарных уведомлений ===
  const fired = new Set();
  function fireCalendarEvent(desc, timeStr, ts) {
    if (fired.has(ts)) return;
    fired.add(ts);
    notifyAudio.play().catch(() => {});
    if (Notification.permission === 'granted') {
      new Notification('Напоминание', {
        body: `${timeStr} — ${desc}`,
        icon: '/miniapps/calendar/icon.png',
        tag: String(ts),
        renotify: true,
        requireInteraction: true,
        silent: false
      });
    }
  }
  function scheduleCalendarEvent(timeStr, desc) {
    const dateStr = getLocalDateStr();
    const [hh, mm] = timeStr.split(':').map(Number);
    const ts = toTimestamp(dateStr, hh, mm);
    const delay = ts - Date.now();
    if (delay > 0) setTimeout(() => fireCalendarEvent(desc, timeStr, ts), delay);
    else if (delay >= -1000) setTimeout(() => fireCalendarEvent(desc, timeStr, ts), 0);
  }
  function scheduleTodaysEvents() {
    const dateStr = getLocalDateStr();
    fetch(`/events?date=${dateStr}`, {
      headers: { 'Authorization': `Bearer ${token()}` }
    })
    .then(res => res.ok ? res.json() : [])
    .then(events => {
      events.forEach(({ time, description }) => {
        if (time) scheduleCalendarEvent(time, description);
      });
    })
    .catch(console.error);
  }

  // === Рендер календаря ===
  const monthYearEl = document.getElementById('month-year');
  const grid        = document.getElementById('calendar-grid');
  const prevBtn     = document.getElementById('prev-month');
  const nextBtn     = document.getElementById('next-month');
  let current       = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  async function renderCalendar() {
    grid.innerHTML = '';
    const year  = current.getFullYear();
    const month = current.getMonth() + 1;
    monthYearEl.textContent = current.toLocaleString('ru', { month: 'long', year: 'numeric' });

    const res = await fetch(`/events?year=${year}&month=${month}`, {
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    const dates = res.ok ? await res.json() : [];

    const firstDay    = new Date(year, month-1, 1).getDay() || 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 1; i < firstDay; i++) grid.appendChild(document.createElement('div'));
    for (let d = 1; d <= daysInMonth; d++) {
      const cell    = document.createElement('div');
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      cell.textContent = d;
      if (dateStr === getLocalDateStr()) cell.classList.add('today');
      if (dates.includes(dateStr))       cell.classList.add('has-event');
      cell.onclick = () => openList(dateStr);
      grid.appendChild(cell);
    }
  }
  prevBtn.onclick = () => { current.setMonth(current.getMonth()-1); renderCalendar(); };
  nextBtn.onclick = () => { current.setMonth(current.getMonth()+1); renderCalendar(); };

  // === Оверлей и формы событий ===
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
    listEl.innerHTML = items.length
      ? items.map(i => `<li><span class="event-time">${i.time||'—'}</span> ${i.description}</li>`).join('')
      : '<li>Нет событий</li>';
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
  cancelBtn.onclick = formBack.onclick = () => formOverlay.classList.add('hidden');
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
      if (dateInput.value === getLocalDateStr()) scheduleCalendarEvent(timeInput.value, descInput.value);
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  // === Таймер / Секундомер / Будильник ===
  const budAudio   = new Audio('/miniapps/calendar/bud.mp3');
  const modeSelect = document.getElementById('time-mode');
  const blocks     = {
    stopwatch: document.getElementById('param-stopwatch'),
    countdown: document.getElementById('param-countdown'),
    alarm:     document.getElementById('param-alarm'),
  };
  const display    = document.getElementById('timer-display');
  const startBtn   = document.getElementById('start-time');
  const stopBtn    = document.getElementById('stop-time');
  const resetBtn   = document.getElementById('reset-time');
  let swInterval   = null;
  let cdInterval   = null;
  let alarmTO      = null;

  function updateModeUI() {
    const m = modeSelect.value;
    Object.entries(blocks).forEach(([k, el]) => el.classList.toggle('hidden', k !== m));
    display.textContent = m === 'stopwatch' ? '00:00.000' : '00:00';
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

  startBtn.onclick = () => {
    const mode = modeSelect.value;
    if (mode === 'stopwatch') {
      clearInterval(swInterval);
      const start = Date.now();
      swInterval = setInterval(() => {
        const diff = Date.now() - start;
        const ms = diff % 1000;
        const s  = Math.floor(diff / 1000) % 60;
        const m  = Math.floor(diff / 60000);
        display.textContent = `${pad(m)}:${pad(s)}.${String(ms).padStart(3,'0')}`;
      }, 30);
    }
    else if (mode === 'countdown') {
      clearInterval(cdInterval);
      const secs = Number(document.getElementById('timer-seconds').value);
      if (!secs || secs <= 0) return;
      const endTs = Date.now() + secs * 1000;
      cdInterval = setInterval(() => {
        const rem = endTs - Date.now();
        if (rem <= 0) {
          clearInterval(cdInterval);
          display.textContent = '00:00';
          budAudio.play();
          notify('Таймер', 'Обратный отсчёт завершён');
        } else {
          const s = Math.ceil(rem / 1000);
          display.textContent = `00:${pad(s)}`;
        }
      }, 200);
    }
    else if (mode === 'alarm') {
      clearTimeout(alarmTO);
      const timeStr = document.getElementById('alarm-time').value;
      if (!timeStr) return;
      const [hh, mm] = timeStr.split(':').map(Number);
      const now = new Date();
      let ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm).getTime();
      if (ts <= Date.now()) ts += 24*60*60*1000;
      alarmTO = setTimeout(() => {
        budAudio.play();
        notify('Будильник', `Время: ${timeStr}`);
      }, ts - Date.now());
    }
  };

  stopBtn.onclick = () => {
    clearInterval(swInterval);
    clearInterval(cdInterval);
    clearTimeout(alarmTO);
  };
  resetBtn.onclick = () => {
    clearInterval(swInterval);
    clearInterval(cdInterval);
    clearTimeout(alarmTO);
    updateModeUI();
  };

  // === Инициализация ===
  (async () => {
    await renderCalendar();
    scheduleTodaysEvents();
  })();

})();
