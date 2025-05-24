(() => {
  // табы
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    };
  });

  // === Календарь ===
  const today        = new Date();
  let current        = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthYearEl  = document.getElementById('month-year');
  const grid         = document.getElementById('calendar-grid');
  const prevBtn      = document.getElementById('prev-month');
  const nextBtn      = document.getElementById('next-month');
  const addBtn       = document.getElementById('add-event-btn');
  const formOverlay  = document.getElementById('event-form');
  const formBack     = formOverlay.querySelector('.form-backdrop');
  const cancelBtn    = document.getElementById('cancel-event');
  const saveBtn      = document.getElementById('save-event');
  const dateInput    = document.getElementById('event-date');
  const timeInput    = document.getElementById('event-time');
  const descInput    = document.getElementById('event-desc');

  // Получаем из БД массив строк вида ['2025-05-12', ...]
  async function fetchEventDates(year, month) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/events?year=${year}&month=${month}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return [];
    return await res.json();
  }

  async function renderCalendar() {
    grid.innerHTML = '';
    const year  = current.getFullYear();
    const month = current.getMonth() + 1; // 1–12

    monthYearEl.textContent = current.toLocaleString('ru', { month: 'long', year: 'numeric' });
    const eventDates = await fetchEventDates(year, month);

    const firstDay   = new Date(year, month - 1, 1).getDay() || 7;
    const daysInMonth= new Date(year, month, 0).getDate();

    // пустые ячейки перед началом месяца
    for (let i = 1; i < firstDay; i++) {
      grid.appendChild(document.createElement('div'));
    }
    // дни
    for (let d = 1; d <= daysInMonth; d++) {
      const cell    = document.createElement('div');
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cell.textContent = d;

      if (dateStr === today.toISOString().slice(0,10)) {
        cell.classList.add('today');
      }
      if (eventDates.includes(dateStr)) {
        cell.classList.add('has-event');  // CSS-класс для подсветки
      }
      cell.onclick = () => openForm(dateStr);
      grid.appendChild(cell);
    }
  }

  function openForm(dateStr) {
    formOverlay.classList.remove('hidden');
    dateInput.value = dateStr;
    timeInput.value = '';
    descInput.value = '';
  }

  async function saveEvent() {
    const payload = {
      date: dateInput.value,
      time: timeInput.value,
      desc: descInput.value
    };
    const token = localStorage.getItem('token');
    const res = await fetch('/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      alert('Ошибка при сохранении');
      return;
    }
    formOverlay.classList.add('hidden');
    await renderCalendar();  // чтобы сразу обновить подсветку
  }

  function closeForm() {
    formOverlay.classList.add('hidden');
  }

  // Навигация по месяцам
  prevBtn.onclick = () => { current.setMonth(current.getMonth() - 1); renderCalendar(); };
  nextBtn.onclick = () => { current.setMonth(current.getMonth() + 1); renderCalendar(); };

  addBtn.onclick     = () => openForm(today.toISOString().slice(0,10));
  cancelBtn.onclick  = closeForm;
  formBack.onclick   = closeForm;
  saveBtn.onclick    = saveEvent;

  renderCalendar();

  // === Заметки ===
  const notesArea = document.getElementById('notes-area');
  notesArea.value = localStorage.getItem('tm-notes') || '';
  notesArea.oninput = () => localStorage.setItem('tm-notes', notesArea.value);

  // === Таймер ===
  let timerInterval = null;
  let startTime     = null;
  const display     = document.getElementById('timer-display');
  const startBtn2   = document.getElementById('start-timer');
  const stopBtn2    = document.getElementById('stop-timer');
  const resetBtn2   = document.getElementById('reset-timer');

  function updateTimer() {
    const diff = Date.now() - startTime;
    const hrs  = String(Math.floor(diff/3600000)).padStart(2,'0');
    const mins = String(Math.floor(diff%3600000/60000)).padStart(2,'0');
    const secs = String(Math.floor(diff%60000/1000)).padStart(2,'0');
    display.textContent = `${hrs}:${mins}:${secs}`;
  }
  startBtn2.onclick = () => {
    if (timerInterval) return;
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 500);
  };
  stopBtn2.onclick = () => {
    clearInterval(timerInterval);
    timerInterval = null;
  };
  resetBtn2.onclick = () => {
    clearInterval(timerInterval);
    timerInterval = null;
    display.textContent = '00:00:00';
  };
})();
