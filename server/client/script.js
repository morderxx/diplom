// Добавляем обработчик для кнопки "Продолжить"
document.getElementById('continue-btn').addEventListener('click', function() {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('captcha-screen').classList.remove('hidden');
});

// Функция для возврата назад
function goBack(screenId) {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('captcha-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    
    document.getElementById(screenId).classList.remove('hidden');
}

// Проверка капчи
function verifyCaptcha() {
    // В реальном приложении здесь будет проверка ответа капчи
    // Для примера просто переходим на экран входа
    document.getElementById('captcha-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    
    // Здесь должна быть реальная проверка:
    // var response = grecaptcha.getResponse();
    // if(response.length != 0) { ... }
}

// Показ формы регистрации
function showRegister() {
    document.getElementById('keyword').classList.remove('hidden');
    document.getElementById('registerButton').classList.remove('hidden');
    document.getElementById('loginButton').classList.add('hidden');
    document.getElementById('registerToggleButton').classList.add('hidden');
}

// Остальной код остается как было
const API_URL = '/api';

async function login() {
  const loginValue = document.getElementById('login').value;
  const password   = document.getElementById('password').value;

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

  const profRes = await fetch(`${API_URL}/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (profRes.ok) {
    const prof = await profRes.json();
    if (!prof.nickname) {
      window.location.href = 'profile.html';
      return;
    }
    localStorage.setItem('nickname', prof.nickname);
  } else {
    window.location.href = 'profile.html';
    return;
  }

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

  await login();
}
