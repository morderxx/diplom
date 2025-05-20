// server/client/script.js
const API_URL = '/api';

function showRegister() {
  document.getElementById('keyword').style.display = 'block';
  document.getElementById('registerButton').style.display = 'block';
}

async function login() {
  const userLogin = document.getElementById('login').value;
  const password  = document.getElementById('password').value;

  // 1) Логинимся
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: userLogin, pass: password })
  });
  if (!res.ok) {
    document.getElementById('message').innerText = 'Ошибка входа';
    return;
  }
  const { token } = await res.json();
  localStorage.setItem('token', token);

  // 2) Подгружаем профиль
  const profRes = await fetch(`${API_URL}/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!profRes.ok) {
    // Профиля нет → заполняем
    return window.location.href = 'profile.html';
  }

  const profile = await profRes.json();
  // Если nickname не задан — считаем профиль неполным
  if (!profile.nickname) {
    return window.location.href = 'profile.html';
  }

  // 3) Всё есть — идём в чат
  window.location.href = 'chat.html';
}

async function register() {
  const userLogin = document.getElementById('login').value;
  const password  = document.getElementById('password').value;
  const keyword   = document.getElementById('keyword').value;

  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: userLogin, pass: password, keyword })
  });
  if (!res.ok) {
    document.getElementById('message').innerText = 'Ошибка регистрации';
    return;
  }

  // После регистрации — сразу логинимся
  await login();
}

// Навешиваем обработчики
document.getElementById('registerButton').onclick = register;
document.getElementById('loginButton').onclick    = login;
document.getElementById('showRegister').onclick   = showRegister;
