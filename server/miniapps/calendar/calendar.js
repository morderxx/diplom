(() => {
  const modal         = document.getElementById('calendar-modal');
  const backdrop      = modal.querySelector('.modal-backdrop');
  const closeBtn      = document.getElementById('close-calendar');
  const monthYear     = document.getElementById('month-year');
  const prevBtn       = document.getElementById('prev-month');
  const nextBtn       = document.getElementById('next-month');
  const grid          = document.getElementById('calendar-grid');
  const addEventBtn   = document.getElementById('add-event-btn');
  const formOverlay   = document.getElementById('event-form');
  const formBackdrop  = formOverlay.querySelector('.form-backdrop');
  const cancelBtn     = document.getElementById('cancel-event');
  const saveBtn       = document.getElementById('save-event');
  const dateInput     = document.getElementById('event-date');
  const timeInput     = document.getElementById('event-time');
  const descInput     = document.getElementById('event-desc');

  let today   = new Date();
  let current = new Date(today.getFullYear(), today.getMonth(), 1);

  // Отобразить календарь
  function renderCalendar() {
    grid.innerHTML = '';
    const year  = current.getFullYear();
    const month = current.getMonth();
    monthYear.textContent = current.toLocaleString('ru', { month: 'long', year: 'numeric' });

    const firstDay   = new Date(year, month, 1).getDay() || 7;
    const daysInMonth= new Date(year, month+1, 0).getDate();

    for (let i = 1; i < firstDay; i++) grid.append(document.createElement('div'));
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      cell.textContent = d;
      const cellDate = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (cellDate === today.toISOString().slice(0,10)) cell.classList.add('today');
      cell.onclick = () => openForm(cellDate);
      grid.append(cell);
    }
  }

  // Открыть форму
  function openForm(dateStr) {
    formOverlay.classList.remove('hidden');
    dateInput.value = dateStr;
    timeInput.value = '';
    descInput.value = '';
  }

  // Сохранить событие
  function saveEvent() {
    const key = dateInput.value;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push({ time: timeInput.value, desc: descInput.value });
    localStorage.setItem(key, JSON.stringify(list));
    formOverlay.classList.add('hidden');
  }

  // Закрыть модалки
  function closeCalendar() { modal.classList.add('hidden'); }
  function closeForm() { formOverlay.classList.add('hidden'); }

  // Обработчики
  prevBtn.onclick     = () => { current.setMonth(current.getMonth()-1); renderCalendar(); };
  nextBtn.onclick     = () => { current.setMonth(current.getMonth()+1); renderCalendar(); };
  addEventBtn.onclick = () => openForm(today.toISOString().slice(0,10));
  closeBtn.onclick    = closeCalendar;
  backdrop.onclick    = closeCalendar;
  cancelBtn.onclick   = closeForm;
  formBackdrop.onclick= closeForm;
  saveBtn.onclick     = saveEvent;

  // Инициализация
  renderCalendar();
})();