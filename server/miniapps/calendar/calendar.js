// server/miniapps/calendar/calendar.js
// Обёртка в async IIFE для возможности await
(async () => {
  // === Общие утилиты ===
  const token = () => localStorage.getItem('token');
  const pad   = n => String(n).padStart(2, '0');

  // === 1) Инициализация SimpleMDE для заметок ===
  const NOTES_API = '/notes';
  let initialNotes = '';
  try {
    const res = await fetch(NOTES_API, {
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    if (res.ok) {
      const { content } = await res.json();
      initialNotes = content;
    }
  } catch (err) {
    console.error('Не удалось загрузить заметки:', err);
  }

  const simplemde = new SimpleMDE({
    element:       document.getElementById('notes-area'),
    initialValue:  initialNotes,
    toolbar:       ['bold','italic','heading','|','quote','unordered-list','ordered-list','|','link','image'],
    autosave: {
      enabled:      true,
      delay:        1000,
      uniqueId:     `notes-${localStorage.getItem('nickname')}`,
      saveFunction: async (plainText, onSuccess, onError) => {
        try {
          const r = await fetch(NOTES_API, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token()}`,
              'Content-Type':  'application/json'
            },
            body: JSON.stringify({ content: plainText })
          });
          if (!r.ok) throw new Error(await r.text());
          onSuccess();
        } catch (e) {
          console.error('Не удалось сохранить заметки:', e);
          onError(e);
        }
      }
    }
  });
  // Включаем сразу режим предпросмотра (рендерим Markdown)
  simplemde.togglePreview();

  // === 2) Таб-навигатор ===
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // === 3) Рендер календаря и все, что было у вас далее ===
  const getLocalDateStr = (d = new Date()) =>
    `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  let current = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
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
      const cell    = document.createElement('div');
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      cell.textContent = d;
      if (dateStr === getLocalDateStr()) cell.classList.add('today');
      if (eventDates.includes(dateStr))  cell.classList.add('has-event');
      cell.onclick = () => openList(dateStr);
      grid.appendChild(cell);
    }
  }

  // Overlay: список событий и форма
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
      : items.map(i =>
          `<li><span class="event-time">${i.time||'—'}</span>` +
          `<span class="event-desc">${i.description}</span></li>`
        ).join('');
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
  cancelBtn.onclick = () => formOverlay.classList.add('hidden');
  formBack.onclick  = () => formOverlay.classList.add('hidden');
  prevBtn.onclick  = () => { current.setMonth(current.getMonth()-1); renderCalendar(); };
  nextBtn.onclick  = () => { current.setMonth(current.getMonth()+1); renderCalendar(); };
  saveBtn.onclick  = async () => {
    try {
      const body = { date: dateInput.value, time: timeInput.value, desc: descInput.value };
      const r = await fetch('/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(await r.text());
      formOverlay.classList.add('hidden');
      await renderCalendar();
    } catch (e) {
      alert(e.message);
      console.error(e);
    }
  };

  // Инициализация
  await renderCalendar();
})();
