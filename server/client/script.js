// Добавляем обработчик для кнопки "Продолжить"
document.getElementById('continue-btn').addEventListener('click', function() {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
});

// Функция для возврата назад
function goBack() {
    // Если открыта форма регистрации - возвращаем на экран входа
    if (!document.getElementById('keyword').classList.contains('hidden')) {
        document.getElementById('keyword').classList.add('hidden');
        document.getElementById('registerButton').classList.add('hidden');
        document.getElementById('loginButton').classList.remove('hidden');
        document.getElementById('registerToggleButton').classList.remove('hidden');
        return;
    }
    
    // Иначе возвращаем на экран приветствия
    document.getElementById('welcome-screen').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('captcha-modal').classList.add('hidden');
    document.getElementById('reset-password-modal').classList.add('hidden');
}

// Глобальные переменные для управления капчей
let captchaWidgetId = null;
let captchaVerified = false;
let captchaToken = '';

// Показать модальное окно капчи
function showCaptchaModal() {
    document.getElementById('captcha-modal').classList.remove('hidden');
    document.getElementById('captcha-message').innerText = '';
    document.getElementById('verify-captcha-btn').classList.add('disabled-btn');
    document.getElementById('verify-captcha-btn').disabled = true;
    
    // Если капча уже пройдена - восстанавливаем состояние
    if (captchaVerified && captchaToken) {
        document.getElementById('verify-captcha-btn').classList.remove('disabled-btn');
        document.getElementById('verify-captcha-btn').disabled = false;
        grecaptcha.reset(captchaWidgetId);
    } else {
        // Инициализация при первом открытии
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
}

// Закрыть модальное окно капчи
function closeCaptchaModal() {
    document.getElementById('captcha-modal').classList.add('hidden');
}

// Колбэк при успешном прохождении капчи
function onCaptchaSuccess(token) {
    document.getElementById('verify-captcha-btn').classList.remove('disabled-btn');
    document.getElementById('verify-captcha-btn').disabled = false;
    captchaToken = token;
}

// Колбэк при истечении времени капчи
function onCaptchaExpired() {
    document.getElementById('captcha-message').innerText = 'Время проверки истекло. Пожалуйста, пройдите проверку снова.';
    document.getElementById('verify-captcha-btn').classList.add('disabled-btn');
    document.getElementById('verify-captcha-btn').disabled = true;
    captchaToken = '';
    grecaptcha.reset(captchaWidgetId);
}

// Колбэк при ошибке капчи
function onCaptchaError() {
    document.getElementById('captcha-message').innerText = 'Произошла ошибка при загрузке капчи. Пожалуйста, попробуйте еще раз.';
    document.getElementById('verify-captcha-btn').classList.add('disabled-btn');
    document.getElementById('verify-captcha-btn').disabled = true;
    captchaToken = '';
}

// Проверка капчи с реальной верификацией
async function verifyCaptcha() {
    if (!captchaToken) {
        document.getElementById('captcha-message').innerText = 'Пожалуйста, пройдите проверку reCAPTCHA';
        return;
    }
    
    // Сохраняем текущее действие
    const pendingAction = window.pendingAction;
    
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
            body: JSON.stringify({ captcha: captchaToken })
        });
        
        const data = await res.json();
        
        if (data.success) {
            captchaVerified = true;
            closeCaptchaModal();
            
            // Выполняем действие, для которого требовалась капча
            if (pendingAction === 'login') {
                await login();
            } else if (pendingAction === 'register') {
                await register();
            } else if (pendingAction === 'reset') {
                await resetPassword();
            }
        } else {
            let errorMessage = 'Ошибка проверки reCAPTCHA. Попробуйте еще раз.';
            captchaToken = '';
            grecaptcha.reset(captchaWidgetId);
            captchaVerified = false;
            
            if (data['error-codes']) {
                if (data['error-codes'].includes('timeout-or-duplicate')) {
                    errorMessage = 'Время проверки истекло. Пожалуйста, пройдите проверку снова.';
                } else if (data['error-codes'].includes('missing-input-secret')) {
                    errorMessage = 'Ошибка сервера: отсутствует секретный ключ';
                }
            }
            
            document.getElementById('captcha-message').innerText = errorMessage;
        }
    } catch (error) {
        console.error('Captcha verification error:', error);
        document.getElementById('captcha-message').innerText = 'Ошибка соединения с сервером. Проверьте интернет-соединение.';
        captchaToken = '';
        grecaptcha.reset(captchaWidgetId);
        captchaVerified = false;
    } finally {
        // Восстанавливаем кнопку
        const verifyBtn = document.getElementById('verify-captcha-btn');
        verifyBtn.disabled = false;
        verifyBtn.innerText = 'Подтвердить';
        window.pendingAction = null;
    }
}

// Отмена прохождения капчи
function cancelCaptcha() {
    captchaToken = '';
    captchaVerified = false;
    closeCaptchaModal();
    grecaptcha.reset(captchaWidgetId);
}

// Показ формы регистрации
function showRegister() {
    document.getElementById('keyword').classList.remove('hidden');
    document.getElementById('registerButton').classList.remove('hidden');
    document.getElementById('loginButton').classList.add('hidden');
    document.getElementById('registerToggleButton').classList.add('hidden');
    document.getElementById('message').innerText = ''; // Сбрасываем сообщение
}

// Обработчики для кнопок входа и регистрации
function handleLogin() {
    const loginValue = document.getElementById('login').value;
    const password   = document.getElementById('password').value;

    // Если капча уже пройдена - сразу выполняем вход
    if (captchaVerified) {
        login();
        return;
    }

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

    // Если капча уже пройдена - сразу выполняем регистрацию
    if (captchaVerified) {
        register();
        return;
    }

    if (!loginInput || !password || !keyword) {
        document.getElementById('message').innerText = 'Пожалуйста, заполните все поля';
        return;
    }

    // Проверка сложности пароля: минимум 7 символов и хотя бы 1 буква
    if (password.length < 7) {
        document.getElementById('message').innerText = 'Пароль должен содержать не менее 7 символов';
        return;
    }
    
    if (!/[a-zA-Z]/.test(password)) {
        document.getElementById('message').innerText = 'Пароль должен содержать хотя бы одну английскую букву';
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
    // Сбрасываем капчу при ошибке входа
    captchaVerified = false;
    captchaToken = '';
    grecaptcha.reset(captchaWidgetId);
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
    // Сбрасываем капчу при ошибке регистрации
    captchaVerified = false;
    captchaToken = '';
    grecaptcha.reset(captchaWidgetId);
    return;
  }

  // Сбрасываем капчу после успешной регистрации
  captchaVerified = false;
  captchaToken = '';
  grecaptcha.reset(captchaWidgetId);
  
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

// Показать модальное окно восстановления пароля
function showResetModal() {
    document.getElementById('reset-password-modal').classList.remove('hidden');
    document.getElementById('reset-message').innerText = '';
    window.pendingAction = 'reset';
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

    // Проверка сложности нового пароля
    if (newPassword.length < 7) {
        document.getElementById('reset-message').innerText = 'Пароль должен содержать не менее 7 символов';
        return;
    }
    
    if (!/[a-zA-Z]/.test(newPassword)) {
        document.getElementById('reset-message').innerText = 'Пароль должен содержать хотя бы одну английскую букву';
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
            setTimeout(() => {
                closeResetModal();
                document.getElementById('message').innerText = 'Пароль успешно изменен!';
                // Сбрасываем капчу после успешного сброса
                captchaVerified = false;
                captchaToken = '';
                grecaptcha.reset(captchaWidgetId);
            }, 2000);
        } else {
            document.getElementById('reset-message').innerText = data.message || 'Ошибка при смене пароля';
            // Сбрасываем капчу при ошибке
            captchaVerified = false;
            captchaToken = '';
            grecaptcha.reset(captchaWidgetId);
        }
    } catch (error) {
        console.error('Password reset error:', error);
        document.getElementById('reset-message').innerText = 'Ошибка сети';
        // Сбрасываем капчу при ошибке сети
        captchaVerified = false;
        captchaToken = '';
        grecaptcha.reset(captchaWidgetId);
    }
}
