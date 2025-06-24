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
        const responseText = await res.text();
        let errorResponse = null;
        
        try {
            errorResponse = JSON.parse(responseText);
        } catch {
            // Если не JSON, оставляем как текст
        }

        // Проверка на конфликт никнейма
        let isNicknameConflict = false;
        
        // 1. Проверка по тексту ответа
        if (responseText.includes('already exists') ||
            responseText.includes('duplicate key') ||
            responseText.includes('idx_users_nickname') ||
            responseText.includes('23505')) {
            isNicknameConflict = true;
        }
        // 2. Проверка структуры JSON
        else if (errorResponse) {
            isNicknameConflict = (
                errorResponse.error?.code === '23505' ||
                errorResponse.error?.constraint === 'idx_users_nickname' ||
                errorResponse.code === '23505' ||
                (errorResponse.detail && errorResponse.detail.includes('already exists')) ||
                (errorResponse.error && errorResponse.error.includes('already exists'))
            );
        }

        if (isNicknameConflict) {
            document.getElementById('message').innerText = 
                'Этот никнейм уже занят. Пожалуйста, выберите другой.';
        } else {
            // Формируем сообщение об ошибке
            let errorMessage = 'Ошибка сохранения профиля';
            
            if (errorResponse) {
                // Пытаемся извлечь сообщение из JSON
                errorMessage = errorResponse.error?.message || 
                              errorResponse.message || 
                              errorResponse.detail ||
                              JSON.stringify(errorResponse);
            } else {
                // Используем текст ответа
                errorMessage = responseText.substring(0, 200);
            }
            
            document.getElementById('message').innerText = 
                `Ошибка: ${errorMessage} (код: ${res.status})`;
        }
        
    } catch (error) {
        console.error('Ошибка при сохранении профиля:', error);
        document.getElementById('message').innerText = 
            'Произошла ошибка при сохранении профиля. Попробуйте ещё раз.';
    }
}
