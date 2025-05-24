(() => {
  // табы (без изменений)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    };
  });

  // === Элементы ===
  const today       = new Date();
  let current       = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthYearEl = document.getElementById('month-year');
  const grid        = document.getElementById('calendar-grid');
  const prevBtn     = document.getElementById('prev-month');
  const nextBtn     = document.getElementById('next-month');

  // Оверлеи
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

  // === Вспомогательные API ===
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

    for (let i = 1; i < firstDay; i++) grid.appendChild(document.createElement('div'));

    for (let d = 1; d <= daysInMonth; d++) {
      const cell    = document.createElement('div');
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cell.textContent = d;
      if (dateStr === today.toISOString().slice(0,10)) cell.classList.add('today');
      if (eventDates.includes(dateStr))       cell.classList.add('has-event');
      // Теперь — не форма, а список событий
      cell.onclick = () => openList(dateStr);
      grid.appendChild(cell);
    }
  }

  // === Открыть список событий на дату ===
  async function openList(dateStr) {
    const items = await fetchEventsByDate(dateStr);
    listDateEl.textContent = dateStr;
    listEl.innerHTML = items.length
      ? items.map(i => `<li>${i.event_time || '—'}  ${i.description}</li>`).join('')
      : '<li>Нет событий</li>';
    // запоминаем дату для создания
    dateInput.value = dateStr;
    listOverlay.classList.remove('hidden');
  }

  // === Закрыть список ===
  closeList.onclick = () => listOverlay.classList.add('hidden');

  // === Открыть форму создания ===
  addNewBtn.onclick = () => {
    listOverlay.classList.add('hidden');
    timeInput.value = '';
    descInput.value = '';
    formOverlay.classList.remove('hidden');
  };

  // === Сохранить новое событие ===
  saveBtn.onclick = async () => {
    try {
      await createEvent({
        date: dateInput.value,
        time: timeInput.value,
        desc: descInput.value
      });
      formOverlay.classList.add('hidden');
      await renderCalendar();
    } catch (e) {
      alert(e.message);
    }
  };

  // === Закрыть форму ===
  cancelBtn.onclick = () => formOverlay.classList.add('hidden');
  formBack.onclick   = () => formOverlay.classList.add('hidden');

  // === Навигация ===
  prevBtn.onclick = () => { current.setMonth(current.getMonth()-1); renderCalendar(); };
  nextBtn.onclick = () => { current.setMonth(current.getMonth()+1); renderCalendar(); };

  renderCalendar();
})();
