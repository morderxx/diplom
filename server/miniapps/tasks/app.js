// Элементы
const taskForm   = document.getElementById('task-form');
const taskInput  = document.getElementById('task-input');
const dueInput   = document.getElementById('due-input');
const tagsInput  = document.getElementById('tags-input');
const taskList   = document.getElementById('task-list');
const filterBtns = document.querySelectorAll('#filters button');
const notifyArea = document.getElementById('notification-area');

let tasks = [];
let currentFilter = 'all';

// Загрузка
async function loadFromServer() {
  try {
    const res  = await fetch('/api/tasks');
    const json = await res.json();
    tasks = json.tasks;
  } catch {
    tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  }
  saveLocally();
  renderTasks();
}

// Сохранение
function saveLocally() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}
async function syncWithServer() {
  try {
    await fetch('/api/tasks/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks })
    });
  } catch (e) {
    console.warn('Sync failed:', e);
  }
}
function saveAll() {
  saveLocally();
  syncWithServer();
}

// Рендер
function renderTasks() {
  taskList.innerHTML = '';
  tasks
    .filter(t => {
      if (currentFilter === 'active') return !t.done;
      if (currentFilter === 'completed') return t.done;
      return true;
    })
    .forEach((t, i) => {
      const li = document.createElement('li');
      if (t.done) li.classList.add('completed');

      const tagsHtml = (t.tags || []).map(x => `<span class="tag">${x}</span>`).join('');
      const dueTxt   = t.due ? `<small class="due">${new Date(t.due).toLocaleString()}</small>` : '';

      li.innerHTML = `
        <div>
          <span onclick="toggleTask(${i})">${t.text}</span>
          ${dueTxt}
        </div>
        <div class="meta">
          ${tagsHtml}
          <button onclick="deleteTask(${i})">✕</button>
        </div>
      `;
      taskList.append(li);
    });
  scheduleReminders();
}

// CRUD
function addTask(text, due, tags) {
  tasks.unshift({ text, done: false, due, tags });
  saveAll(); renderTasks();
}
function toggleTask(i) {
  tasks[i].done = !tasks[i].done;
  saveAll(); renderTasks();
}
function deleteTask(i) {
  tasks.splice(i, 1);
  saveAll(); renderTasks();
}

// Фильтры
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

// Форма
taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  addTask(text, dueInput.value || null, tagsInput.value.split(',').map(x=>x.trim()).filter(x=>x));
  taskForm.reset();
});

// Уведомления
function showNotification(msg) {
  const d = document.createElement('div');
  d.className = 'notify';
  d.innerText = msg;
  notifyArea.append(d);
  setTimeout(() => notifyArea.removeChild(d), 5000);
}
function pushSystemNotification(title, opts) {
  if (Notification.permission === 'granted') {
    new Notification(title, opts);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, opts);
    });
  }
}

// Напоминания
function scheduleReminders() {
  tasks.forEach((t, i) => {
    if (t.due && !t.done) {
      const delta = new Date(t.due) - Date.now();
      if (delta > 0) {
        setTimeout(() => {
          showNotification(`Срок задачи "${t.text}" наступил!`);
          pushSystemNotification('Таск-менеджер', { body: `Задача "${t.text}"` });
        }, delta);
      }
    }
  });
}

// Старт
window.addEventListener('load', loadFromServer);
