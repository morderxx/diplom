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
  const audio = new Audio('notify.mp3');
  audio.preload = 'auto';
  document.body.addEventListener('click', () => {
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
  }, { once: true });
  if ('Notification' in window) Notification.requestPermission().then(p => console.log('Notification permission:', p));

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

  // === Планирование уведомлений ===
  const notified = new Set();
  function scheduleEvent(time, description) {
    const dateStr = getLocalDateStr();
    const [hh, mm] = time.split(':').map(Number);
    const ts = toTimestamp(dateStr, hh, mm);
    const now = Date.now();
    const delay = ts - now;
    console.log(`Scheduling '${description}' at ${time}, delay=${delay}ms`);
    if (delay > 0) {
      setTimeout(() => fireEvent(description, time, ts), delay);
    } else if (delay >= -1000) {
      // если событие уже почти наступило
      setTimeout(() => fireEvent(description, time, ts), 0);
    }
  }
  function fireEvent(description, time, ts) {
    if (notified.has(ts)) return;
    notified.add(ts);
    audio.play().catch(() => {});
    if (Notification.permission === 'granted') {
      new Notification('Напоминание', {
        body: `${time} — ${description}`,
        icon: 'icon.png',
        tag: String(ts),
        renotify: true,
        requireInteraction: true
      });
    }
    console.log(`🚀 Fired '${description}' at ${time}`);
  }
  function scheduleTodaysEvents() {
    const dateStr = getLocalDateStr();
    fetch(`/events?date=${dateStr}`, { headers: { 'Authorization': `Bearer ${token()}` } })
      .then(res => res.ok ? res.json() : [])
      .then(events => events.forEach(e => { if (e.time) scheduleEvent(e.time, e.description); }))
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

  // === Оверлей списка и форма ===
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
      : items.map(i => `<li><span class=\"event-time\">${i.time||'—'}</span> <span class=\"event-desc\">${i.description}</span></li>`).join('');
    dateInput.value = dateStr;
    listOverlay.classList.remove('hidden');
  }
  closeList.onclick = () => listOverlay.classList.add('hidden');
  addNewBtn.onclick = () => { listOverlay.classList.add('hidden'); timeInput.value = ''; descInput.value = ''; formOverlay.classList.remove('hidden'); };

  saveBtn.onclick = async () => {
    try {
      const body = { date: dateInput.value, time: timeInput.value, desc: descInput.value };
      const res = await fetch('/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token()}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`Ошибка ${res.status}: ${await res.text()}`);
      formOverlay.classList.add('hidden');
      await renderCalendar();
      // при добавлении события на сегодня — сразу расписать уведомление
      if (dateInput.value === getLocalDateStr()) scheduleEvent(timeInput.value, descInput.value);
    } catch (e) {
      console.error(e); alert(e.message);
    }
  };
  cancelBtn.onclick = () => formOverlay.classList.add('hidden');
  formBack.onclick   = () => formOverlay.classList.add('hidden');
  prevBtn.onclick   = () => { current.setMonth(current.getMonth()-1); renderCalendar(); };
  nextBtn.onclick   = () => { current.setMonth(current.getMonth()+1); renderCalendar(); };

  // Первичный запуск
  (async () => {
    await renderCalendar();
    scheduleTodaysEvents();
  })();
})();
