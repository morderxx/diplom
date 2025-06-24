// server/client/profile.js
const API_URL = '/api';

async function saveProfile() {
    const nickname = document.getElementById('nickname').value;
    const full_name = document.getElementById('full_name').value;
    const birthdate = document.getElementById('birthdate').value;
    const bio = document.getElementById('bio').value;
    const token = localStorage.getItem('token');

    // Проверка заполненности всех полей
    if (!nickname || !full_name || !birthdate || !bio) {
        document.getElementById('message').innerText = 'Все поля обязательны для заполнения';
        return;
    }

    // Проверка возраста (минимум 12 лет)
    const birthDate = new Date(birthdate);
    const today = new Date();
    let ageYears = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Корректировка возраста, если день рождения ещё не наступил
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        ageYears--;
    }
    
    if (ageYears < 12) {
        document.getElementById('message').innerText = 'Вы должны быть старше 12 лет';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                nickname,
                full_name,
                age: birthdate,
                bio
            })
        });

        // Успешный ответ
        if (res.ok) {
            localStorage.setItem('nickname', nickname);
            document.getElementById('message').innerText = 'Профиль сохранён!';
            setTimeout(() => {
                window.location.href = 'chat.html';
            }, 1000);
            return;
        }

        // Обработка ошибок
        let errorResponse;
        try {
            // Пытаемся распарсить JSON
            errorResponse = await res.json();
        } catch {
            // Если не JSON, читаем как текст
            errorResponse = await res.text();
        }

        // Проверка на конфликт никнейма
        const isNicknameConflict = (
            (typeof errorResponse === 'string' && (
                errorResponse.includes('already exists') ||
                errorResponse.includes('duplicate key') ||
                errorResponse.includes('idx_users_nickname') ||
                errorResponse.includes('23505')
            )) ||
            (typeof errorResponse === 'object' && (
                errorResponse.error?.code === '23505' ||
                errorResponse.error?.constraint === 'idx_users_nickname' ||
                errorResponse.code === '23505' ||
                errorResponse.detail?.includes('already exists') ||
                errorResponse.message?.includes('already exists') ||
                errorResponse.error?.message?.includes('already exists')
            ))
        );

        if (isNicknameConflict) {
            document.getElementById('message').innerText = 
                'Этот никнейм уже занят. Пожалуйста, выберите другой.';
        } else {
            // Формируем сообщение об ошибке
            let errorMessage = 'Ошибка сохранения профиля';
            
            if (typeof errorResponse === 'string') {
                errorMessage += `: ${errorResponse.substring(0, 100)}`;
            } else if (typeof errorResponse === 'object') {
                errorMessage += `: ${errorResponse.message || errorResponse.error?.message || 'Неизвестная ошибка сервера'}`;
            }
            
            document.getElementById('message').innerText = errorMessage;
        }
        
    } catch (error) {
        console.error('Сетевая ошибка:', error);
        document.getElementById('message').innerText = 
            'Сетевая ошибка. Проверьте подключение к интернету.';
    }
}
