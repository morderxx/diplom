const API_URL = '/api';


function showRegister() {
    document.getElementById('keyword').style.display = 'block';
    document.getElementById('registerButton').style.display = 'block';
}

async function login() {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    localStorage.setItem('login', login);

    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, pass: password })
    });

    if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', login); // Сохраняем логин

        // 🔥 Теперь дополнительно получаем профиль пользователя
        const profileRes = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${data.token}` }
        });

        if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (profileData.nickname) {
                localStorage.setItem('nickname', profileData.nickname);
            }
        }

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
        // После успешной регистрации сразу логинимся
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, pass: password })
        });

        if (loginRes.ok) {
            const data = await loginRes.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('login', login);

            document.getElementById('message').innerText = 'Регистрация успешна!';
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 1000);
        } else {
            document.getElementById('message').innerText = 'Ошибка входа после регистрации';
        }
    } else {
        document.getElementById('message').innerText = 'Ошибка регистрации';
    }
}


