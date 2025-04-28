const API_URL = '/api';

function showRegister() {
  document.getElementById('keyword').style.display = 'block';
  document.getElementById('registerButton').style.display = 'block';
}

async function login() {
  const login = document.getElementById('login').value;
  const password = document.getElementById('password').value;
  localStorage.setItem('login', login);

  // 1) Логинимся
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, pass: password })
  });

  if (!res.ok) {
    document.getElementById('message').innerText = 'Ошибка входа';
    return;
  }

  const { token } = await res.json();
  localStorage.setItem('token', token);

  // 2) Подгружаем профиль
  const profileRes = await fetch(`${API_URL}/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (profileRes.ok) {
    const profileData = await profileRes.json();
    if (profileData.nickname) {
      localStorage.setItem('nickname', profileData.nickname);
    }
  }

  // 3) Переходим в чат
  window.location.href = 'chat.html';
}

async function register() {
  const login = document.getElementById('login').value;
  const password = document.getElementById('password').value;
  const keyword = document.getElementById('keyword').value;

  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, pass: password, keyword })
  });

  if (!res.ok) {
    document.getElementById('message').innerText = 'Ошибка регистрации';
    return;
  }

  // Автологин после регистрации
  const loginRes = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, pass: password })
  });

  if (loginRes.ok) {
    const { token } = await loginRes.json();
    localStorage.setItem('token', token);
    localStorage.setItem('login', login);
    window.location.href = 'profile.html';
  } else {
    document.getElementById('message').innerText = 'Ошибка входа после регистрации';
  }
}
