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

  // === Звук и разрешения календаря ===
  const audio = new Audio('/miniapps/calendar/notify.mp3');
  audio.preload = 'auto';
  document.body.addEventListener('click', () => {
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
  }, { once: true });
  if ('Notification' in window) Notification.requestPermission();

  // === Звук для будильника и таймера ===
  const budAudio = new Audio('/miniapps/calendar/bud.mp3');
  budAudio.preload = 'auto';

  // === Утилиты ===
  const pad = n => String(n).padStart(2, '0');
  function getLocalDateStr(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }
  function toTimestamp(dateStr, hh, mm, ss = 0) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m-1, d, hh, mm, ss).getTime();
  }

  // === Авторизация ===
  const token = () => localStorage.getItem('token');

  // === Календарь: планировщик уведомлений ===
  const notified = new Set();
  function fireEvent(desc, timeStr, ts) {
    if (notified.has(ts)) return;
    notified.add(ts);
    audio.play().catch(()=>{});
    if (Notification.permission === 'granted') {
      new Notification('Напоминание', {
        body: `${timeStr} — ${desc}`,
        icon: '/miniapps/calendar/icon.png',
        tag: String(ts),
        renotify: true,
        requireInteraction: true
      });
    }
  }
  function scheduleEvent(timeStr, desc) {
    const [hh, mm] = timeStr.split(':').map(Number);
    const ts = toTimestamp(getLocalDateStr(), hh, mm);
    const delay = ts - Date.now();
    if (delay > 0) setTimeout(() => fireEvent(desc, timeStr, ts), delay);
    else if (delay >= -1000) setTimeout(() => fireEvent(desc, timeStr, ts), 0);
  }
  function scheduleTodaysEvents() {
    const dateStr = getLocalDateStr();
    fetch(`/events?date=${dateStr}`, {
      headers:{ 'Authorization': `Bearer ${token()}` }
    })
      .then(r=>r.ok? r.json():[])
      .then(events=> events.forEach(e=> e.time && scheduleEvent(e.time, e.description)))
      .catch(console.error);
  }

  // === Будильники и таймеры: планировщик и UI ===
  function scheduleUserTimers() {
    fetch('/timers',{ headers:{ 'Authorization':`Bearer ${token()}` } })
      .then(r=>r.ok? r.json():[])
      .then(items=>{
        const now = Date.now();
        const alarmsList = document.getElementById('alarms-list');
        const timersList = document.getElementById('timers-list');
        alarmsList.innerHTML = '';
        timersList.innerHTML = '';

        items.forEach(({id,type,time})=>{
          const fireTs = new Date(time).getTime();
          const delay = fireTs - now;

          // уведомление
          if (delay >= 0) {
            setTimeout(()=>{
              budAudio.play().catch(()=>{});
              if (Notification.permission==='granted') {
                new Notification(
                  type==='alarm' ? '⏰ Будильник' : '⏳ Таймер',
                  { body: `${type==='alarm'?'Будильник':'Таймер'} сработал`, tag:`timer-${id}`, renotify:true, requireInteraction:true }
                );
              }
            }, delay);
          }

          // рендер списка
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.textContent = 'Отменить';
          btn.className = 'btn secondary btn-small';
          btn.onclick = ()=>{
            fetch(`/timers/${id}`,{
              method:'DELETE',
              headers:{ 'Authorization':`Bearer ${token()}` }
            })
            .then(res=>{
              if(!res.ok) throw new Error('Не удалось удалить');
              li.remove();
            })
            .catch(err=> alert(err.message));
          };
          li.textContent = `${type==='alarm'?'Будильник':'Таймер'}: ${new Date(time).toLocaleTimeString()} `;
          li.appendChild(btn);
          if (type==='alarm') alarmsList.appendChild(li);
          else timersList.appendChild(li);
        });
      })
      .catch(console.error);
  }

  // === Календарь: рендер ===
  const today = new Date();
  let current = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthYearEl = document.getElementById('month-year');
  const grid         = document.getElementById('calendar-grid');
  const prevBtn      = document.getElementById('prev-month');
  const nextBtn      = document.getElementById('next-month');

  async function renderCalendar() {
    grid.innerHTML = '';
    const year=current.getFullYear(), month=current.getMonth()+1;
    monthYearEl.textContent = current.toLocaleString('ru',{month:'long',year:'numeric'});
    const res = await fetch(`/events?year=${year}&month=${month}`, {
      headers:{ 'Authorization':`Bearer ${token()}` }
    });
    const dates = res.ok? await res.json():[];
    const firstDay = new Date(year,month-1,1).getDay()||7;
    const daysInMonth = new Date(year,month,0).getDate();
    for(let i=1;i<firstDay;i++) grid.appendChild(document.createElement('div'));
    for(let d=1;d<=daysInMonth;d++){
      const cell=document.createElement('div');
      const ds=`${year}-${pad(month)}-${pad(d)}`;
      cell.textContent=d;
      if(ds===getLocalDateStr()) cell.classList.add('today');
      if(dates.includes(ds))     cell.classList.add('has-event');
      cell.onclick=()=>openList(ds);
      grid.appendChild(cell);
    }
  }

  // === Календарь: оверлей событий ===
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
      headers:{ 'Authorization':`Bearer ${token()}` }
    });
    const items = res.ok? await res.json():[];
    listEl.innerHTML = items.length===0
      ? '<li>Нет событий</li>'
      : items.map(i=>`<li><span class="event-time">${i.time||'—'}</span><span class="event-desc">${i.description}</span></li>`).join('');
    dateInput.value = dateStr;
    listOverlay.classList.remove('hidden');
  }
  closeList.onclick = ()=> listOverlay.classList.add('hidden');
  addNewBtn.onclick = ()=>{ listOverlay.classList.add('hidden'); timeInput.value=''; descInput.value=''; formOverlay.classList.remove('hidden'); };
  cancelBtn.onclick=()=> formOverlay.classList.add('hidden');
  formBack.onclick=()=> formOverlay.classList.add('hidden');
  saveBtn.onclick = async ()=>{
    try {
      const body = { date: dateInput.value, time: timeInput.value, desc: descInput.value };
      const res = await fetch('/events',{
        method:'POST',
        headers:{ 'Authorization':`Bearer ${token()}`, 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });
      if(!res.ok) throw new Error(`Ошибка ${res.status}`);
      formOverlay.classList.add('hidden');
      await renderCalendar();
      if(dateInput.value===getLocalDateStr()) scheduleEvent(timeInput.value, descInput.value);
    } catch(e){ console.error(e); alert(e.message); }
  };
  prevBtn.onclick=()=>{current.setMonth(current.getMonth()-1); renderCalendar();};
  nextBtn.onclick=()=>{current.setMonth(current.getMonth()+1); renderCalendar();};

  // === Навигация по режимам «Время» ===
  document.querySelectorAll('.time-switch').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('.time-switch').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.time-mode').forEach(m=>m.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.mode}-mode`).classList.remove('hidden');
    };
  });

  // === Будильник ===
  let alarmTimeout;
  document.getElementById('set-alarm').onclick = () => {
    const timeVal = document.getElementById('alarm-time').value;
    const [hh,mm] = timeVal.split(':').map(Number);
    const now = new Date();
    const alarmTime = new Date(now.getFullYear(),now.getMonth(),now.getDate(),hh,mm,0);
    const delay = alarmTime.getTime() - now.getTime();
    if(delay<=0) return alert('Время уже прошло');
    clearTimeout(alarmTimeout);
    alarmTimeout = setTimeout(()=>{
      budAudio.play(); alert('⏰ Будильник!');
    }, delay);
    document.getElementById('alarm-status').textContent=`Будильник: ${timeVal}`;
    // сохранить и обновить список
    fetch('/timers',{
      method:'POST',
      headers:{ 'Authorization':`Bearer ${token()}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ type:'alarm', time: alarmTime.toISOString() })
    })
    .then(r=>{
      if(!r.ok) throw new Error('Ошибка сохранения');
      scheduleUserTimers();
    }).catch(e=>alert(e.message));
  };

// === Таймер (минуты + секунды) ===
let timerTimeout;
document.getElementById('start-timer').onclick = () => {
  const mins = parseInt(document.getElementById('timer-minutes').value, 10) || 0;
  const secs = parseInt(document.getElementById('timer-seconds').value, 10) || 0;
  if (mins < 0 || secs < 0 || secs > 59) {
    return alert('Введите корректные минуты и секунды (0–59).');
  }
  const totalMs = (mins * 60 + secs) * 1000;
  if (totalMs <= 0) {
    return alert('Нужно ввести хотя бы 1 секунду');
  }

  clearTimeout(timerTimeout);
  timerTimeout = setTimeout(() => {
    budAudio.play();
    alert('⏳ Таймер завершён!');
  }, totalMs);

  document.getElementById('timer-status').textContent =
    `Таймер: ${mins} мин ${secs} сек`;
  
  // Сохраняем в БД
  const fireTime = new Date(Date.now() + totalMs).toISOString();
  fetch('/timers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token()}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({
      type: 'timer',
      time: fireTime
    })
  })
  .then(res => {
    if (!res.ok) throw new Error('Не удалось сохранить таймер');
    scheduleUserTimers(); // обновляем список
  })
  .catch(err => alert(err.message));
};


  // === Секундомер с миллисекундами ===
  let swInterval, swStart, swElapsed=0;
  const swDisplay = document.getElementById('stopwatch-display');
  const startSw = document.getElementById('start-stopwatch');
  const stopSw  = document.createElement('button');
  stopSw.textContent='Стоп'; stopSw.className='btn secondary btn-small';
  document.getElementById('stopwatch-mode').appendChild(stopSw);

  startSw.onclick = () => {
    if(swInterval) return;
    swStart = Date.now() - swElapsed;
    swInterval = setInterval(()=>{
      swElapsed = Date.now() - swStart;
      const ms = swElapsed % 1000;
      const totalSec = Math.floor(swElapsed/1000);
      const s = totalSec % 60;
      const m = Math.floor(totalSec/60)%60;
      const h = Math.floor(totalSec/3600);
      swDisplay.textContent = `${pad(h)}:${pad(m)}:${pad(s)}.${String(ms).padStart(3,'0')}`;
    }, 50);
  };
  stopSw.onclick = () => {
    clearInterval(swInterval); swInterval = null;
  };
  document.getElementById('reset-stopwatch').onclick = () => {
    clearInterval(swInterval); swInterval=null; swElapsed=0;
    swDisplay.textContent='00:00:00.000';
  };

  // === Инициализация ===
  (async()=>{
    await renderCalendar();
    scheduleTodaysEvents();
    scheduleUserTimers();
  })();
})();
