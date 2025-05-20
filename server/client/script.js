// server/client/script.js
const API_URL = '/api';

function showRegister() {
  document.getElementById('keyword').style.display = 'block';
  document.getElementById('registerButton').style.display = 'block';
}

async function login() {
  const loginValue = document.getElementById('login').value;
  const password   = document.getElementById('password').value;

  // 1) Логинимся
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginValue, pass: password })
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
    const prof = await profRes.json();
    // если ника нет — считаем профиль не заполненным
    if (!prof.nickname) {
      window.location.href = 'profile.html';
      return;
    }
    localStorage.setItem('nickname', prof.nickname);
  } else {
    // 404 или другая ошибка
    window.location.href = 'profile.html';
    return;
  }

  // 3) Идём в чат
  window.location.href = 'chat.html';
}


async function register() {
  const loginInput = document.getElementById('login').value;
  const password   = document.getElementById('password').value;
  const keyword    = document.getElementById('keyword').value;

  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginInput, pass: password, keyword })
  });
  if (!res.ok) {
    document.getElementById('message').innerText = 'Ошибка регистрации';
    return;
  }

  // После регистрации — сразу логинимся
  await login();
}


document.getElementById('registerButton').onclick = register;
