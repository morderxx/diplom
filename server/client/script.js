// Screen transitions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Continue button
document.getElementById('continue-btn').addEventListener('click', function() {
    showScreen('captcha-screen');
});

// Back functionality
function goBack(screenId) {
    showScreen(screenId);
}

// CAPTCHA verification
async function verifyCaptcha() {
    const captchaResponse = grecaptcha.getResponse();
    
    if (!captchaResponse) {
        document.getElementById('captcha-message').textContent = 'Пожалуйста, пройдите проверку reCAPTCHA';
        return;
    }
    
    try {
        const res = await fetch('/api/verify-captcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ captcha: captchaResponse })
        });
        
        const data = await res.json();
        
        if (data.success) {
            showScreen('login-screen');
        } else {
            document.getElementById('captcha-message').textContent = 
                'Ошибка проверки: ' + (data['error-codes']?.join(', ') || 'Неизвестная ошибка');
            grecaptcha.reset();
        }
    } catch (error) {
        console.error('CAPTCHA error:', error);
        document.getElementById('captcha-message').textContent = 'Ошибка соединения';
    }
}

// Toggle register form
function showRegister() {
    document.getElementById('keyword-group').classList.remove('hidden');
    document.getElementById('registerButton').classList.remove('hidden');
    document.getElementById('loginButton').classList.add('hidden');
    document.getElementById('registerToggleButton').classList.add('hidden');
}

// API functions
const API_URL = '/api';

async function login() {
    const loginValue = document.getElementById('login').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: loginValue, pass: password })
        });
        
        if (!res.ok) {
            throw new Error('Ошибка входа');
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
    } catch (error) {
        document.getElementById('message').textContent = error.message;
    }
}

async function register() {
    const loginInput = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const keyword = document.getElementById('keyword').value;

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: loginInput, pass: password, keyword })
        });
        
        if (!res.ok) {
            throw new Error('Ошибка регистрации');
        }

        await login();
    } catch (error) {
        document.getElementById('message').textContent = error.message;
    }
}
