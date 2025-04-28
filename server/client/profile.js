const API_URL = '/api';

async function saveProfile() {
    const full_name = document.getElementById('full_name').value;
    const age = document.getElementById('age').value;
    const bio = document.getElementById('bio').value;
    const avatar_url = document.getElementById('avatar_url').value;

    const token = localStorage.getItem('token');

    const res = await fetch(`${API_URL}/profile`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ full_name, age, bio, avatar_url })
    });

    if (res.ok) {
        document.getElementById('message').innerText = 'Профиль сохранён!';
        setTimeout(() => {
            window.location.href = 'chat.html';
        }, 1000);
    } else {
        document.getElementById('message').innerText = 'Ошибка сохранения профиля';
    }
}
