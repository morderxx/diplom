// Добавляем обработчик для кнопки "Продолжить"
document.getElementById('continue-btn').addEventListener('click', function() {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
});

// Функция для возврата назад
function goBack(screenId) {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    
    document.getElementById(screenId).classList.remove('hidden');
}

// Показать модальное окно капчи
function showCaptchaModal() {
    document.getElementById('captcha-modal').classList.remove('hidden');
    grecaptcha.reset();
    document.getElementById('captcha-message').innerText = '';
}

// Закрыть модальное окно капчи
function closeCaptchaModal() {
    document.getElementById('captcha-modal').classList.add('hidden');
}

// Проверка капчи с реальной верификацией
async function verifyCaptcha() {
    const captchaResponse = grecaptcha.getResponse();
    
    if (!captchaResponse) {
        document.getElementById('captcha-message').innerText = 'Пожалуйста, пройдите проверку reCAPTCHA';
        return;
    }
    
    try {
        // Проверка капчи на сервере
        const res = await fetch('/api/verify-captcha', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ captcha: captchaResponse })
        });
        
        const data = await res.json();
        
        if (data.success) {
            // Активируем кнопки
            document.getElementById('loginButton').disabled = false;
            document.getElementById('loginButton').classList.remove('disabled-btn');
            
            const registerButton = document.getElementById('registerButton');
            if (!registerButton.classList.contains('hidden')) {
                registerButton.disabled = false;
                registerButton.classList.remove('disabled-btn');
            }
            
            closeCaptchaModal();
            document.getElementById('captcha-message').innerText = '';
        } else {
            let errorMessage = 'Ошибка проверки reCAPTCHA. Попробуйте еще раз.';
            
            if (data['error-codes']) {
                if (data['error-codes'].includes('timeout-or-duplicate')) {
                    errorMessage = 'Время проверки истекло. Пожалуйста, пройдите проверку снова.';
                } else if (data['error-codes'].includes('missing-input-secret')) {
                    errorMessage = 'Ошибка сервера: отсутствует секретный ключ';
                }
            }
            
            document.getElementById('captcha-message').innerText = errorMessage;
            
            // Перезагружаем капчу
            grecaptcha.reset();
        }
    } catch (error) {
        console.error('Captcha verification error:', error);
        document.getElementById('captcha-message').innerText = 'Ошибка соединения с сервером. Проверьте интернет-соединение.';
    }
}

// Показ формы регистрации
function showRegister() {
    document.getElementById('keyword').classList.remove('hidden');
    document.getElementById('registerButton').classList.remove('hidden');
    document.getElementById('loginButton').classList.add('hidden');
    document.getElementById('registerToggleButton').classList.add('hidden');
}

// Обработчики для кнопок входа и регистрации
function handleLogin() {
    if (document.getElementById('loginButton').disabled) {
        showCaptchaModal();
    } else {
        login();
    }
}

function handleRegister() {
    if (document.getElementById('registerButton').disabled) {
        showCaptchaModal();
    } else {
        register();
    }
}

// Остальной код остается как было
const API_URL = '/api';

async function login() {
  const loginValue = document.getElementById('login').value;
  const password   = document.getElementById('password').value;

  if (!loginValue || !password) {
    document.getElementById('message').innerText = 'Пожалуйста, заполните все поля';
    return;
  }

  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginValue, pass: password })
  });
  
  if (!res.ok) {
    document.getElementById('message').innerText = 'Ошибка входа: неверный логин или пароль';
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

  if (!loginInput || !password || !keyword) {
    document.getElementById('message').innerText = 'Пожалуйста, заполните все поля';
    return;
  }

  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginInput, pass: password, keyword })
  });
  
  if (!res.ok) {
    document.getElementById('message').innerText = 'Ошибка регистрации: такой логин уже существует';
    return;
  }

  await login();
}
