(() => {
  // === Service Worker Registration ===
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered'))
      .catch(err => console.error('Service Worker registration failed:', err));
  }

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
  
  // Автоматическая разблокировка аудио
  const unlockAudio = () => {
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      console.log('Audio unlocked');
    }).catch(console.error);
  };
  
  document.body.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockAudio();
  });

  // === Элементы ===
  const today = new Date();
  let current = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthYearEl = document.getElementById('month-year');
  const grid = document.getElementById('calendar-grid');
  const prevBtn = document.getElementById('prev-month');
  const nextBtn = document.getElementById('next-month');

  // Оверлеи
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

  // === Управление уведомлениями ===
  const notified = new Set();
  const scheduledTimers = new Set();

  function fireNotification(time, description, eventTs) {
    if (notified.has(eventTs)) return;
    notified.add(eventTs);
    
    // Воспроизведение звука с обработкой ошибок
    audio.play().catch(error => {
      console.error('Audio error:', error);
      document.body.click(); // Пытаемся разблокировать
      setTimeout(() => audio.play().catch(console.error), 500);
    });

    // Показ уведомления
    if (Notification.permission === 'granted') {
      try {
        new Notification('Напоминание', {
          body: `${time} — ${description}`,
          icon: 'icon.png',
          requireInteraction: true
        });
      } catch (e) {
        console.error('Notification error:', e);
      }
    }
  }

  function scheduleNotifications(events, dateStr) {
    // Очистка предыдущих таймеров
    scheduledTimers.forEach(timer => clearTimeout(timer));
    scheduledTimers.clear();
    notified.clear();

    const now = Date.now();
    events.forEach(({ time, description }) => {
      if (!time) return;

      // Корректное вычисление времени с часовым поясом
      const [hh, mm] = time.split(':').map(Number);
      const eventDate = new Date(dateStr);
      eventDate.setHours(hh, mm, 0, 0);
      const eventTs = eventDate.getTime();
      
      const delay = eventTs - now;
      console.log(`Scheduling "${description}" at ${time} (${eventDate.toLocaleString()}), delay: ${delay}ms`);

      if (delay > -60000) { // До 1 минуты после события
        const timer = setTimeout(() => {
          fireNotification(time, description, eventTs);
          scheduledTimers.delete(timer);
        }, Math.max(delay, 0));
        
        scheduledTimers.add(timer);
      }
    });
  }

  // === API Methods ===
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ date, time, desc })
    });
    if (!res.ok) throw new Error('Ошибка сохранения');
  }

  // === Calendar Rendering ===
  async function renderCalendar() {
    grid.innerHTML = '';
    const year = current.getFullYear();
    const month = current.getMonth() + 1;

    monthYearEl.textContent = current.toLocaleString('ru', { 
      month: 'long', 
      year: 'numeric' 
    });

    const eventDates = await fetchEventDates(year, month);
    const firstDay = new Date(year, month - 1, 1).getDay() || 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    // Заполнение календаря
    Array.from({ length: firstDay - 1 }).forEach(() => 
      grid.appendChild(document.createElement('div')));
    
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      
      cell.textContent = d;
      cell.classList.toggle('today', dateStr === today.toISOString().slice(0, 10));
      cell.classList.toggle('has-event', eventDates.includes(dateStr));
      cell.onclick = () => openList(dateStr);
      
      grid.appendChild(cell);
    }

    // Обновление уведомлений для текущего месяца
    if (year === today.getFullYear() && month === today.getMonth() + 1) {
      const todayEvents = await fetchEventsByDate(today.toISOString().slice(0, 10));
      scheduleNotifications(todayEvents, today.toISOString().slice(0, 10));
    }
  }

  // === Event List Management ===
  async function openList(dateStr) {
    const items = await fetchEventsByDate(dateStr);
    listDateEl.textContent = dateStr;
    
    listEl.innerHTML = items.length 
      ? items.map(i => `
          <li>
            <span class="event-time">${i.time || '—'}</span>
            <span class="event-desc">${i.description}</span>
          </li>
        `).join('')
      : '<li>Нет событий</li>';
    
    scheduleNotifications(items, dateStr);
    dateInput.value = dateStr;
    listOverlay.classList.remove('hidden');
  }

  // === Event Handlers ===
  closeList.onclick = () => listOverlay.classList.add('hidden');
  
  addNewBtn.onclick = () => {
    listOverlay.classList.add('hidden');
    timeInput.value = '';
    descInput.value = '';
    formOverlay.classList.remove('hidden');
  };

  saveBtn.onclick = async () => {
    try {
      await createEvent({
        date: dateInput.value,
        time: timeInput.value,
        desc: descInput.value
      });
      
      formOverlay.classList.add('hidden');
      await renderCalendar();
      
      if (dateInput.value === today.toISOString().slice(0, 10)) {
        const todayEvents = await fetchEventsByDate(dateInput.value);
        scheduleNotifications(todayEvents, dateInput.value);
      }
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  cancelBtn.onclick = () => formOverlay.classList.add('hidden');
  formBack.onclick = () => formOverlay.classList.add('hidden');

  prevBtn.onclick = () => {
    current.setMonth(current.getMonth() - 1);
    renderCalendar();
  };

  nextBtn.onclick = () => {
    current.setMonth(current.getMonth() + 1);
    renderCalendar();
  };

  // === Инициализация ===
  (async () => {
    await renderCalendar();
    
    // Проверка разрешений
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        console.log('Notification permission:', p);
      });
    }

    // Обновление при возвращении на страницу
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const todayStr = new Date().toISOString().slice(0, 10);
        fetchEventsByDate(todayStr).then(events => 
          scheduleNotifications(events, todayStr)
        );
      }
    });
  })();
})();
