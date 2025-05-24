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
  // разблокируем autoplay при первом клике
  document.body.addEventListener('click', () => {
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      console.log('Audio unlocked for autoplay');
    }).catch(() => {});
  }, { once: true });

  // запрос разрешения на системные уведомления
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p => {
      console.log('Notification permission:', p);
    });
  }

  // === Элементы ===
  const today       = new Date();
  let current       = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthYearEl = document.getElementById('month-year');
  const grid        = document.getElementById('calendar-grid');
  const prevBtn     = document.getElementById('prev-month');
  const nextBtn     = document.getElementById('next-month');

  // Оверлеи списка и формы
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

  // === Планирование уведомлений ===
  const notified = new Set();
  function fireNotification(time, description, eventTs) {
    if (notified.has(eventTs)) return;
    notified.add(eventTs);
    console.log(`🚀 Fire "${description}" at ${time}`);
    audio.play().catch(()=>{});
    if (Notification.permission === 'granted') {
      new Notification('Напоминание', {
        body: `${time} — ${description}`,
        icon: 'icon.png'
      });
    }
  }
  
  function scheduleNotifications(events, dateStr) {
    const now = Date.now();
    events.forEach(({ time, description }) => {
      if (!time) return;
      const [hh, mm] = time.split(':').map(Number);
      const eventTs = new Date(
        `${dateStr}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`
      ).getTime();
      const delay = eventTs - now;
      console.log(`Scheduling "${description}" at ${time}: delay=${delay}ms`);
      if (delay > 0) {
        setTimeout(() => fireNotification(time, description, eventTs), delay);
      } else if (delay >= -60000) {
        // событие было до минуты назад — сразу уведомляем
        setTimeout(() => fireNotification(time, description, eventTs), 0);
      }
    });
  }

  // === API ===
  const token = () => localStorage.getItem('token');

  async function fetchEventDates(year, month) {
    const res = await fetch(`/events?year=${year}&month=${month}`, {
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    return res.ok ? res.json() : [];
  }

  async function fetchEventsByDate(date) {
    const res = await fetch(`/events?date=${date}`, {
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    return res.ok ? res.json() : [];
  }

  async function createEvent({ date, time, desc }) {
    const res = await fetch('/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token()}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ date, time, desc })
    });
    if (!res.ok) throw new Error('Ошибка при сохранении');
  }

  // === Рендер календаря ===
  async function renderCalendar() {
    grid.innerHTML = '';
    const year  = current.getFullYear();
    const month = current.getMonth() + 1;

    monthYearEl.textContent = current.toLocaleString('ru', { month: 'long', year: 'numeric' });
    const eventDates = await fetchEventDates(year, month);

    const firstDay    = new Date(year, month-1, 1).getDay() || 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 1; i < firstDay; i++) {
      grid.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell    = document.createElement('div');
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cell.textContent = d;
      if (dateStr === today.toISOString().slice(0,10)) cell.classList.add('today');
      if (eventDates.includes(dateStr))       cell.classList.add('has-event');
      cell.onclick = () => openList(dateStr);
      grid.appendChild(cell);
    }
  }

  // === Открыть список событий ===
  async function openList(dateStr) {
    const items = await fetchEventsByDate(dateStr);
    listDateEl.textContent = dateStr;
    if (items.length === 0) {
      listEl.innerHTML = '<li>Нет событий</li>';
    } else {
      listEl.innerHTML = items.map(i => `
        <li>
          <span class="event-time">${i.time || '—'}</span>
          <span class="event-desc">${i.description}</span>
        </li>
      `).join('');
      scheduleNotifications(items, dateStr);
    }
    dateInput.value = dateStr;
    listOverlay.classList.remove('hidden');
  }

  // === Закрыть список ===
  closeList.onclick = () => listOverlay.classList.add('hidden');

  // === Открыть форму для нового события ===
  addNewBtn.onclick = () => {
    listOverlay.classList.add('hidden');
    timeInput.value = '';
    descInput.value = '';
    formOverlay.classList.remove('hidden');
  };

  // === Сохранить событие ===
  saveBtn.onclick = async () => {
    try {
      await createEvent({
        date: dateInput.value,
        time: timeInput.value,
        desc: descInput.value
      });
      formOverlay.classList.add('hidden');
      await renderCalendar();
      if (dateInput.value === today.toISOString().slice(0,10)) {
        scheduleNotifications([{ time: timeInput.value, description: descInput.value }], dateInput.value);
      }
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  // === Закрыть форму ===
  cancelBtn.onclick = () => formOverlay.classList.add('hidden');
  formBack.onclick   = () => formOverlay.classList.add('hidden');

  // === Навигация месяца ===
  prevBtn.onclick = () => { current.setMonth(current.getMonth()-1); renderCalendar(); };
  nextBtn.onclick = () => { current.setMonth(current.getMonth()+1); renderCalendar(); };

  // Первичный рендер + планирование на сегодня
  (async () => {
    await renderCalendar();
    const todayStr    = today.toISOString().slice(0,10);
    const todayEvents = await fetchEventsByDate(todayStr);
    scheduleNotifications(todayEvents, todayStr);
  })();
})();
