// server/client/script.js
const API_URL = '/api';

function showRegister() {
  document.getElementById('keyword').style.display = 'block';
  document.getElementById('registerButton').style.display = 'block';
}

async function login() {
  const login    = document.getElementById('login').value;
  const password = document.getElementById('password').value;

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
  const profRes = await fetch(`${API_URL}/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (profRes.ok) {
    const { nickname } = await profRes.json();
    localStorage.setItem('nickname', nickname);
  } else {
    window.location.href = 'profile.html';
    return;
  }

  // 3) Идём в чат
  window.location.href = 'chat.html';
}

async function register() {
  const login    = document.getElementById('login').value;
  const password = document.getElementById('password').value;
  const keyword  = document.getElementById('keyword').value;

  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, pass: password, keyword })
  });
  if (!res.ok) {
    document.getElementById('message').innerText = 'Ошибка регистрации';
    return;
  }

  // После регистрации — сразу логинимся
   await login();
}

document.getElementById('registerButton').onclick = register;
