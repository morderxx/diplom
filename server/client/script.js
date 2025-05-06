// server/client/script.js
const API_URL = '/api';

function showRegister() {
  document.getElementById('keyword').style.display = 'block';
  document.getElementById('registerButton').style.display = 'block';
}

async function login() {
  const login    = document.getElementById('login').value;
  const password = document.getElementById('password').value;
  localStorage.setItem('login', login);

  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, pass: password })
  });

  if (!res.ok) {
    document.getElementById('message').innerText = 'Ошибка входа';
    return;
  }

  const { token, id } = await res.json();
  localStorage.setItem('token', token);
  localStorage.setItem('userId', id);

  const profileRes = await fetch(`${API_URL}/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (profileRes.ok) {
    const profileData = await profileRes.json();
    if (profileData.nickname) {
      localStorage.setItem('nickname', profileData.nickname);
    }
  }

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

  const loginRes = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, pass: password })
  });

  if (loginRes.ok) {
    const { token, id } = await loginRes.json();
    localStorage.setItem('token', token);
    localStorage.setItem('userId', id);
    localStorage.setItem('login', login);
    window.location.href = 'profile.html';
  } else {
    document.getElementById('message').innerText = 'Ошибка входа после регистрации';
  }
}
