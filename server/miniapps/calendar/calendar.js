(() => {
  const container   = document.getElementById('calendar-container');
  const monthYearEl = document.getElementById('month-year');
  const prevBtn     = document.getElementById('prev-month');
  const nextBtn     = document.getElementById('next-month');
  const grid        = document.getElementById('calendar-grid');
  const addBtn      = document.getElementById('add-event-btn');

  const formOverlay = document.getElementById('event-form');
  const formBack    = formOverlay.querySelector('.form-backdrop');
  const cancelBtn   = document.getElementById('cancel-event');
  const saveBtn     = document.getElementById('save-event');
  const dateInput   = document.getElementById('event-date');
  const timeInput   = document.getElementById('event-time');
  const descInput   = document.getElementById('event-desc');

  const today   = new Date();
  let current   = new Date(today.getFullYear(), today.getMonth(), 1);

  function renderCalendar() {
    grid.innerHTML = '';
    const year       = current.getFullYear();
    const month      = current.getMonth();
    monthYearEl.textContent = current.toLocaleString('ru', { month: 'long', year: 'numeric' });

    const firstDay    = new Date(year, month, 1).getDay() || 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // пустые ячейки до первого дня недели
    for (let i = 1; i < firstDay; i++) {
      grid.appendChild(document.createElement('div'));
    }
    // дни месяца
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cell.textContent = d;
      if (dateStr === today.toISOString().slice(0,10)) {
        cell.classList.add('today');
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

  function saveEvent() {
    const key  = dateInput.value;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push({ time: timeInput.value, desc: descInput.value });
    localStorage.setItem(key, JSON.stringify(list));
    formOverlay.classList.add('hidden');
  }

  function closeForm() {
    formOverlay.classList.add('hidden');
  }

  prevBtn.onclick = () => { current.setMonth(current.getMonth() - 1); renderCalendar(); };
  nextBtn.onclick = () => { current.setMonth(current.getMonth() + 1); renderCalendar(); };
  addBtn.onclick  = () => openForm(today.toISOString().slice(0,10));
  cancelBtn.onclick   = closeForm;
  formBack.onclick    = closeForm;
  saveBtn.onclick     = saveEvent;

  // Инициализация
  renderCalendar();
})();
