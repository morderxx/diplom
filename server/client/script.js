// Добавляем обработчик для кнопки "Продолжить"
document.getElementById('continue-btn').addEventListener('click', function() {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
});

// Функция для возврата назад
function goBack() {
    document.getElementById('welcome-screen').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('captcha-modal').classList.add('hidden');
}

// Глобальные переменные для управления капчей
let captchaWidgetId = null;
let captchaVerified = false;

// Показать модальное окно капчи
function showCaptchaModal() {
    document.getElementById('captcha-modal').classList.remove('hidden');
    document.getElementById('captcha-message').innerText = '';
    document.getElementById('verify-captcha-btn').classList.add('disabled-btn');
    document.getElementById('verify-captcha-btn').disabled = true;
    
    // Инициализация капчи только при первом открытии
    if (!captchaWidgetId) {
        captchaWidgetId = grecaptcha.render('captcha-container', {
            'sitekey': '6LczulkrAAAAAC2VSZfgIVzx3bZXWt3WfC3vvta0',
            'callback': onCaptchaSuccess,
            'expired-callback': onCaptchaExpired,
            'error-callback': onCaptchaError
        });
    } else {
        grecaptcha.reset(captchaWidgetId);
    }
}

// Закрыть модальное окно капчи
function closeCaptchaModal() {
    document.getElementById('captcha-modal').classList.add('hidden');
    if (captchaWidgetId) {
        grecaptcha.reset(captchaWidgetId);
    }
}

// Колбэк при успешном прохождении капчи
function onCaptchaSuccess() {
    document.getElementById('verify-captcha-btn').classList.remove('disabled-btn');
    document.getElementById('verify-captcha-btn').disabled = false;
}

// Колбэк при истечении времени капчи
function onCaptchaExpired() {
    document.getElementById('captcha-message').innerText = 'Время проверки истекло. Пожалуйста, пройдите проверку снова.';
    document.getElementById('verify-captcha-btn').classList.add('disabled-btn');
    document.getElementById('verify-captcha-btn').disabled = true;
    grecaptcha.reset(captchaWidgetId);
}

// Колбэк при ошибке капчи
function onCaptchaError() {
    document.getElementById('captcha-message').innerText = 'Произошла ошибка при загрузке капчи. Пожалуйста, попробуйте еще раз.';
    document.getElementById('verify-captcha-btn').classList.add('disabled-btn');
    document.getElementById('verify-captcha-btn').disabled = true;
}

// Проверка капчи с реальной верификацией
async function verifyCaptcha() {
    const captchaResponse = grecaptcha.getResponse(captchaWidgetId);
    
    if (!captchaResponse) {
        document.getElementById('captcha-message').innerText = 'Пожалуйста, пройдите проверку reCAPTCHA';
        return;
    }
    
    try {
        // Показываем загрузку
        const verifyBtn = document.getElementById('verify-captcha-btn');
        verifyBtn.disabled = true;
        verifyBtn.innerText = 'Проверка...';
        
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
            captchaVerified = true;
            closeCaptchaModal();
            document.getElementById('captcha-message').innerText = '';
            
            // Выполняем действие, для которого требовалась капча
            if (window.pendingAction === 'login') {
                login();
            } else if (window.pendingAction === 'register') {
                register();
            }
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
            grecaptcha.reset(captchaWidgetId);
        }
    } catch (error) {
        console.error('Captcha verification error:', error);
        document.getElementById('captcha-message').innerText = 'Ошибка соединения с сервером. Проверьте интернет-соединение.';
    } finally {
        // Восстанавливаем кнопку
        const verifyBtn = document.getElementById('verify-captcha-btn');
        verifyBtn.disabled = false;
        verifyBtn.innerText = 'Подтвердить';
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
    const loginValue = document.getElementById('login').value;
    const password   = document.getElementById('password').value;

    if (!loginValue || !password) {
        document.getElementById('message').innerText = 'Пожалуйста, заполните все поля';
        return;
    }

    window.pendingAction = 'login';
    showCaptchaModal();
}

function handleRegister() {
    const loginInput = document.getElementById('login').value;
    const password   = document.getElementById('password').value;
    const keyword    = document.getElementById('keyword').value;

    if (!loginInput || !password || !keyword) {
        document.getElementById('message').innerText = 'Пожалуйста, заполните все поля';
        return;
    }

    window.pendingAction = 'register';
    showCaptchaModal();
}

// Добавляем обработчик для кнопки подтверждения капчи
document.getElementById('verify-captcha-btn').addEventListener('click', verifyCaptcha);

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

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Явно скрываем модальное окно капчи
    document.getElementById('captcha-modal').classList.add('hidden');
    
    // Инициализируем reCAPTCHA только когда она понадобится
    window.grecaptchaReady = function() {
        console.log('reCAPTCHA готов к использованию');
    };
});


// Добавьте эти функции в script.js

// Показать модальное окно восстановления пароля
function showResetModal() {
    document.getElementById('reset-password-modal').classList.remove('hidden');
    document.getElementById('reset-message').innerText = '';
}

// Закрыть модальное окно восстановления
function closeResetModal() {
    document.getElementById('reset-password-modal').classList.add('hidden');
}

// Функция сброса пароля
async function resetPassword() {
    const login = document.getElementById('reset-login').value;
    const keyword = document.getElementById('reset-keyword').value;
    const newPassword = document.getElementById('new-password').value;

    if (!login || !keyword || !newPassword) {
        document.getElementById('reset-message').innerText = 'Все поля обязательны';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, keyword, newPassword })
        });

        const data = await res.json();
        
        if (res.ok) {
            document.getElementById('reset-message').innerText = 'Пароль успешно изменен!';
            setTimeout(closeResetModal, 2000);
        } else {
            document.getElementById('reset-message').innerText = data.message || 'Ошибка при смене пароля';
        }
    } catch (error) {
        console.error('Password reset error:', error);
        document.getElementById('reset-message').innerText = 'Ошибка сети';
    }
}
