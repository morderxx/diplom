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
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; })
      .catch(() => {});
  }, { once: true });

  if ('Notification' in window) {
    Notification.requestPermission().then(p => console.log('Notification permission:', p));
  }

  // === Утилиты ===
  function toTimestamp(dateStr, hh, mm) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, hh, mm, 0, 0).getTime();
  }

  const notified = new Set();

  function fireNotification(time, description, ts) {
    if (notified.has(ts)) return;
    notified.add(ts);
    audio.play().catch(() => {});
    if (Notification.permission === 'granted') {
      new Notification('Напоминание', {
        body: `За минуту: ${time} — ${description}`,
        icon: 'icon.png'
      });
    }
    console.log(`🚀 Fired "${description}" at ${time}`);
  }

  // === API ===
  const token = () => localStorage.getItem('token');

  async function fetchEventsByDate(date) {
    const res = await fetch(`/events?date=${date}`, {
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    return res.ok ? res.json() : [];
  }

  // === Основная проверка уведомлений ===
  async function checkNotifications() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0,10);
    const now = Date.now();
    const events = await fetchEventsByDate(dateStr);
    for (const { time, description } of events) {
      if (!time) continue;
      const [hh, mm] = time.split(':').map(Number);
      const ts = toTimestamp(dateStr, hh, mm);
      const diff = ts - now;
      if (diff > 0 && diff <= 60000) {
        fireNotification(time, description, ts);
      }
    }
  }

  // Запускать проверку каждую 30 сек
  setInterval(checkNotifications, 30000);
  // И сразу при загрузке
  checkNotifications();

  // === Рендер календаря ===
  const today = new Date();
  let current = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthYearEl = document.getElementById('month-year');
  const grid = document.getElementById('calendar-grid');
  const prevBtn = document.getElementById('prev-month');
  const nextBtn = document.getElementById('next-month');

  async function renderCalendar() {
    grid.innerHTML = '';
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    monthYearEl.textContent = current.toLocaleString('ru', { month: 'long', year: 'numeric' });

    const res = await fetch(`/events?year=${year}&month=${month}`, {
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    const eventDates = res.ok ? await res.json() : [];

    const firstDay = new Date(year, month-1, 1).getDay() || 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 1; i < firstDay; i++) grid.appendChild(document.createElement('div'));

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cell.textContent = d;
      if (dateStr === today.toISOString().slice(0,10)) cell.classList.add('today');
      if (eventDates.includes(dateStr)) cell.classList.add('has-event');
      cell.onclick = () => openList(dateStr);
      grid.appendChild(cell);
    }
  }

  // === Список и форма ===
  const listOverlay = document.getElementById('events-list-overlay');
  const listDateEl = document.getElementById('list-date');
  const listEl = document.getElementById('events-list');
  const addNewBtn = document.getElementById('add-new-event');
  const closeList = document.getElementById('close-list');
  const formOverlay = document.getElementById('event-form');
  const formBack = formOverlay.querySelector('.form-backdrop');
  const cancelBtn = document.getElementById('cancel-event');
  const saveBtn = document.getElementById('save-event');
  const dateInput = document.getElementById('event-date');
  const timeInput = document.getElementById('event-time');
  const descInput = document.getElementById('event-desc');

  async function openList(dateStr) {
    const items = await fetchEventsByDate(dateStr);
    listDateEl.textContent = dateStr;
    if (items.length === 0) listEl.innerHTML = '<li>Нет событий</li>';
    else listEl.innerHTML = items.map(i =>
      `<li><span class="event-time">${i.time||'—'}</span> <span class="event-desc">${i.description}</span></li>`
    ).join('');
    dateInput.value = dateStr;
    listOverlay.classList.remove('hidden');
  }

  closeList.onclick = () => listOverlay.classList.add('hidden');
  addNewBtn.onclick = () => { listOverlay.classList.add('hidden'); timeInput.value=''; descInput.value=''; formOverlay.classList.remove('hidden'); };

  saveBtn.onclick = async () => {
    try {
      await fetch('/events', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateInput.value, time: timeInput.value, desc: descInput.value })
      });
      formOverlay.classList.add('hidden');
      await renderCalendar();
    } catch (e) { console.error(e); alert(e.message); }
  };

  cancelBtn.onclick = () => formOverlay.classList.add('hidden');
  formBack.onclick   = () => formOverlay.classList.add('hidden');
  prevBtn.onclick   = () => { current.setMonth(current.getMonth()-1); renderCalendar(); };
  nextBtn.onclick   = () => { current.setMonth(current.getMonth()+1); renderCalendar(); };

  // === Инициализация ===
  (async () => {
    await renderCalendar();
  })();
})();
