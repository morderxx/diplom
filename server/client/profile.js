// server/client/profile.js
const API_URL = '/api';

async function saveProfile() {
    const nickname  = document.getElementById('nickname').value;
    const full_name = document.getElementById('full_name').value;
    const birthdate = document.getElementById('birthdate').value;
    const bio       = document.getElementById('bio').value;
    const token     = localStorage.getItem('token');

    // Проверка заполненности всех полей
    if (!nickname || !full_name || !birthdate || !bio) {
        document.getElementById('message').innerText = 'Все поля обязательны для заполнения';
        return;
    }

    // Проверка возраста (минимум 12 лет)
    const birthDate = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Корректировка возраста, если день рождения ещё не наступил
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    if (age < 12) {
        document.getElementById('message').innerText = 'Вы должны быть старше 12 лет';
        return;
    }

    const res = await fetch(`${API_URL}/profile`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            nickname,
            full_name,
            age,  // Отправляем возраст в годах
            bio
        })
    });

    if (res.ok) {
        localStorage.setItem('nickname', nickname);
        document.getElementById('message').innerText = 'Профиль сохранён!';
        setTimeout(() => {
            window.location.href = 'chat.html';
        }, 1000);
    } else {
        document.getElementById('message').innerText = 'Ошибка сохранения профиля';
    }
}
