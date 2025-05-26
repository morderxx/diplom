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

  // === Утилиты ===
  const pad = n => String(n).padStart(2, '0');
  function getLocalDateStr(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }

  // === Авторизация ===
  const token = () => localStorage.getItem('token');

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

  // === Оверлей и форма ===
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
      : items.map(i => `<li><span class="event-time">${i.time||'—'}</span> <span class="event-desc">${i.description}</span></li>`).join('');
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

  saveBtn.onclick = async () => {
    try {
      const body = { date: dateInput.value, time: timeInput.value, desc: descInput.value };
      const res = await fetch('/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`Ошибка ${res.status}: ${await res.text()}`);
      formOverlay.classList.add('hidden');
      await renderCalendar();
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  cancelBtn.onclick = () => formOverlay.classList.add('hidden');
  formBack.onclick   = () => formOverlay.classList.add('hidden');
  prevBtn.onclick   = () => { current.setMonth(current.getMonth()-1); renderCalendar(); };
  nextBtn.onclick   = () => { current.setMonth(current.getMonth()+1); renderCalendar(); };
  const area = document.getElementById('notes-area');
// Загрузка
fetch('/notes', { headers: { Authorization: `Bearer ${token()}` } })
  .then(r => r.json())
  .then(data => area.value = data.content || '');

  // notes.js (подключается после авторизации в мессенджере)
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const API = '/notes';

  // 1) Подгрузить текущие заметки
  let initial = '';
  try {
    const res = await fetch(API, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const json = await res.json();
      initial = json.content;
    }
  } catch (e) {
    console.error('Cannot load notes:', e);
  }

  // 2) Инициализировать SimpleMDE
  const simplemde = new SimpleMDE({
    element: document.getElementById("notes-area"),
    initialValue: initial,
    autosave: {
      enabled: true,
      delay:   1000,
      uniqueId: "user-notes",
      saveFunction: async (plainText, onSuccess, onError) => {
        try {
          const r = await fetch(API, {
            method:  'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type':  'application/json'
            },
            body: JSON.stringify({ content: plainText })
          });
          if (!r.ok) throw new Error(await r.text());
          onSuccess();
        } catch (err) {
          console.error('Failed to save notes:', err);
          onError(err);
        }
      }
    },
    toolbar: ["bold","italic","heading","|","quote","unordered-list","ordered-list","|","link","image"]
  });
});


  // === Инициализация ===
  (async () => {
    await renderCalendar();
  })();
})();
