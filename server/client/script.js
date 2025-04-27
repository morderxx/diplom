const API_URL = 'https://diplom-production-df7f.up.railway.app/api';


function showRegister() {
    document.getElementById('keyword').style.display = 'block';
    document.getElementById('registerButton').style.display = 'block';
}

async function login() {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;

    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, pass: password })
    });

    if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        window.location.href = 'chat.html';
    } else {
        document.getElementById('message').innerText = 'Ошибка входа';
    }
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

    if (res.ok) {
        document.getElementById('message').innerText = 'Регистрация успешна!';
    } else {
        document.getElementById('message').innerText = 'Ошибка регистрации';
    }
}
