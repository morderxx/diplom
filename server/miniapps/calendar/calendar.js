// server/miniapps/calendar/calendar.js
(() => {
  // === Навигация основных вкладок ===
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'timer') {
        const first = document.querySelector('.subtab-btn');
        if (first) first.click();
      }
    };
  });

  // === Навигация под-вкладок «Время» ===
  document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.subtab).classList.add('active');
    };
  });

  // === Звук уведомлений ===
  // для календаря
  const audioCal = new Audio('/miniapps/calendar/notify.mp3');
  audioCal.preload = 'auto';
  // для будильника и таймера
  const audioTime = new Audio('/miniapps/calendar/bud.mp3');
  audioTime.preload = 'auto';

  // активируем воспроизведение после первого клика
  document.body.addEventListener('click', () => {
    audioCal.play().then(() => { audioCal.pause(); audioCal.currentTime = 0; }).catch(() => {});
    audioTime.play().then(() => { audioTime.pause(); audioTime.currentTime = 0; }).catch(() => {});
  }, { once: true });

  if ('Notification' in window) {
    Notification.requestPermission();
  }

  // === Хранение в localStorage ===
  const storage = {
    setAlarm(ts)   { localStorage.setItem('alarmTs', ts) },
    clearAlarm()   { localStorage.removeItem('alarmTs') },
    setTimer(ts)   { localStorage.setItem('timerEndTs', ts) },
    clearTimer()   { localStorage.removeItem('timerEndTs') }
  };

  // === Утилиты ===
  const pad = n => String(n).padStart(2, '0');
  function getLocalDateStr(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }
  function toTimestamp(dateStr, hh, mm) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, hh, mm, 0, 0).getTime();
  }

  // === Функции отложенных уведомлений ===
  function scheduleNotification(ts, title, body) {
    const delay = ts - Date.now();
    if (delay < 0) return;
    setTimeout(() => {
      audioTime.play().catch(() => {});
      if (Notification.permission === 'granted') {
        new Notification(title, { body, requireInteraction: true, silent: false });
      }
      // после срабатывания убираем из storage
      if (title === 'Будильник') storage.clearAlarm();
      if (title === 'Таймер')   storage.clearTimer();
    }, delay);
  }

  function fireEvent(description, timeStr, ts) {
    audioCal.play().catch(() => {});
    if (Notification.permission === 'granted') {
      new Notification('Напоминание', {
        body: `${timeStr} — ${description}`,
        icon: '/miniapps/calendar/icon.png',
        requireInteraction: true,
        silent: false
      });
    }
  }
  function scheduleEvent(timeStr, description) {
    const dateStr = getLocalDateStr();
    const [hh, mm] = timeStr.split(':').map(Number);
    const ts = toTimestamp(dateStr, hh, mm);
    const delay = ts - Date.now();
    if (delay > 0) {
      setTimeout(() => fireEvent(description, timeStr, ts), delay);
    } else if (delay >= -1000) {
      setTimeout(() => fireEvent(description, timeStr, ts), 0);
    }
  }

  // === Будильник ===
  let alarmTs = null;
  document.getElementById('set-alarm').onclick = () => {
    const [hh, mm] = document.getElementById('alarm-time').value.split(':').map(Number);
    if (isNaN(hh)) return alert('Укажите время будильника');
    const now = new Date();
    let alarm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
    if (alarm.getTime() <= now.getTime()) alarm.setDate(alarm.getDate() + 1);
    alarmTs = alarm.getTime();
    scheduleNotification(alarmTs, 'Будильник', `Сейчас ${pad(hh)}:${pad(mm)}`);
    storage.setAlarm(alarmTs);
    alert('Будильник установлен');
  };
  document.getElementById('clear-alarm').onclick = () => {
    alarmTs = null;
    storage.clearAlarm();
    alert('Будильник снят');
  };

  // === Таймер ===
  let timerId, timerEnd;
  const timerDisplay = document.getElementById('timer-display');
  document.getElementById('start-timer').onclick = () => {
    const mins = parseInt(document.getElementById('timer-minutes').value, 10);
    if (isNaN(mins) || mins < 0) return alert('Введите корректное число минут');
    timerEnd = Date.now() + mins * 60000;
    clearTimeout(timerId);
    scheduleNotification(timerEnd, 'Таймер', 'Время вышло');
    storage.setTimer(timerEnd);
    updateTimer();
  };
  document.getElementById('stop-timer').onclick = () => clearTimeout(timerId);
  document.getElementById('reset-timer').onclick = () => {
    storage.clearTimer();
    clearTimeout(timerId);
    timerDisplay.textContent = '00:00:00';
  };
  function updateTimer() {
    const diff = Math.max(0, timerEnd - Date.now());
    const h = Math.floor(diff / 3600000),
          m = Math.floor(diff % 3600000 / 60000),
          s = Math.floor(diff % 60000 / 1000);
    timerDisplay.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    if (diff > 0) timerId = setTimeout(updateTimer, 250);
  }

  // === Секундомер ===
  let swStart = 0, swRaf;
  const swDisplay = document.getElementById('sw-display');
  document.getElementById('start-sw').onclick = () => {
    if (!swStart) swStart = Date.now();
    else swStart = Date.now() - (Date.now() - swStart);
    tickSW();
  };
  document.getElementById('stop-sw').onclick = () => cancelAnimationFrame(swRaf);
  document.getElementById('reset-sw').onclick = () => {
    cancelAnimationFrame(swRaf);
    swStart = 0;
    swDisplay.textContent = '00:00:00';
  };
  function tickSW() {
    const diff = Date.now() - swStart;
    const h = Math.floor(diff / 3600000),
          m = Math.floor(diff % 3600000 / 60000),
          s = Math.floor(diff % 60000 / 1000);
    swDisplay.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    swRaf = requestAnimationFrame(tickSW);
  }

  // === Планировщик уведомлений календаря ===
  const token = () => localStorage.getItem('token');
  function scheduleTodaysEvents() {
    const dateStr = getLocalDateStr();
    fetch(`/events?date=${dateStr}`, { headers: { 'Authorization': `Bearer ${token()}` } })
      .then(res => res.ok ? res.json() : [])
      .then(events => {
        events.forEach(({ time, description }) => {
          if (time) scheduleEvent(time, description);
        });
      })
      .catch(console.error);
  }

  // === Рендер календаря ===
  const today = new Date();
  let current = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthYearEl = document.getElementById('month-year');
  const grid        = document.getElementById('calendar-grid');
  document.getElementById('prev-month').onclick = () => { current.setMonth(current.getMonth()-1); renderCalendar(); };
  document.getElementById('next-month').onclick = () => { current.setMonth(current.getMonth()+1); renderCalendar(); };
  async function renderCalendar() {
    grid.innerHTML = '';
    const year = current.getFullYear(), month = current.getMonth() + 1;
    monthYearEl.textContent = current.toLocaleString('ru', { month: 'long', year: 'numeric' });
    const res =	await fetch(`/events?year=${year}&month=${month}`, { headers: { 'Authorization': `Bearer ${token()}` } });
    const eventDates = res.ok ? await res.json() : [];
    const firstDay    = new Date(year, month-1, 1).getDay() || 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let i = 1; i < firstDay; i++) grid.appendChild(document.createElement('div'));
    for (let d = 1; d <= daysInMonth; d++) {
      const cell   = document.createElement('div');
      const dateStr= `${year}-${pad(month)}-${pad(d)}`;
      cell.textContent = d;
      if (dateStr === getLocalDateStr()) cell.classList.add('today');
      if (eventDates.includes(dateStr)) cell.classList.add('has-event');
      cell.onclick = () => openList(dateStr);
      grid.appendChild(cell);
    }
  }

  // === Оверлей событий ===
  const listOverlay = document.getElementById('events-list-overlay');
  const listDateEl  = document.getElementById('list-date');
  const listEl      = document.getElementById('events-list');
  document.getElementById('add-new-event').onclick = () => {
    listOverlay.classList.add('hidden');
    document.getElementById('event-time').value = '';
    document.getElementById('event-desc').value = '';
    document.getElementById('event-form').classList.remove('hidden');
  };
  document.getElementById('close-list').onclick  = () => listOverlay.classList.add('hidden');
  document.getElementById('cancel-event').onclick= () => document.getElementById('event-form').classList.add('hidden');
  document.querySelector('#event-form .form-backdrop').onclick = () => document.getElementById('event-form').classList.add('hidden');
  document.getElementById('save-event').onclick = async () => {
    try {
      const date = document.getElementById('event-date').value;
      const time = document.getElementById('event-time').value;
      const desc = document.getElementById('event-desc').value;
      const res  = await fetch('/events', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time, desc })
      });
      if (!res.ok) throw new Error(`Ошибка ${res.status}: ${await res.text()}`);
      document.getElementById('event-form').classList.add('hidden');
      await renderCalendar();
      if (date === getLocalDateStr()) scheduleEvent(time, desc);
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };
  async function openList(dateStr) {
    listDateEl.textContent = dateStr;
    document.getElementById('event-date').value = dateStr;
    const res   = await fetch(`/events?date=${dateStr}`, { headers: { 'Authorization': `Bearer ${token()}` } });
    const items = res.ok ? await res.json() : [];
    listEl.innerHTML = items.length === 0
      ? '<li>Нет событий</li>'
      : items.map(i => `<li><span class="event-time">${i.time||'—'}</span> <span class="event-desc">${i.description}</span></li>`).join('');
    listOverlay.classList.remove('hidden');
  }

  // === Инициализация ===
  (async () => {
    await renderCalendar();
    scheduleTodaysEvents();
    setInterval(scheduleTodaysEvents, 60000);

    // восстановим из localStorage
    const a = parseInt(localStorage.getItem('alarmTs'), 10);
    if (a && a > Date.now()) scheduleNotification(a, 'Будильник', 'Пора проснуться!');
    const t = parseInt(localStorage.getItem('timerEndTs'), 10);
    if (t && t > Date.now()) scheduleNotification(t, 'Таймер', 'Отсчёт завершён');
  })();

})();
