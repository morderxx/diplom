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
                age: birthdate,  // Отправляем дату рождения в поле age
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
            try {
                const errorData = await res.json();
                
                // Улучшенная проверка на дублирование никнейма
                const isNicknameConflict = (
                    errorData.error?.code === '23505' ||
                    errorData.error?.constraint === 'idx_users_nickname' ||
                    errorData.code === '23505' ||                     // Проверяем корневой уровень
                    errorData.detail?.includes('already exists') ||   // Проверяем детали ошибки
                    errorData.error?.detail?.includes('already exists') ||
                    errorData.message?.includes('already exists') ||
                    errorData.error?.message?.includes('already exists')
                );

                if (isNicknameConflict) {
                    document.getElementById('message').innerText = 
                        'Этот никнейм уже занят. Пожалуйста, выберите другой.';
                } else {
                    // Форматирование сообщения об ошибке
                    const errorMessage = (
                        errorData.error?.message ||
                        errorData.message ||
                        'Неизвестная ошибка'
                    );
                    document.getElementById('message').innerText = 
                        `Ошибка сохранения: ${errorMessage}`;
                }
            } catch (parseError) {
                // Обработка случаев, когда ответ не в JSON формате
                document.getElementById('message').innerText = 
                    `Ошибка сохранения профиля (код: ${res.status})`;
            }
        }
    } catch (error) {
        console.error('Сетевая ошибка:', error);
        document.getElementById('message').innerText = 
            'Сетевая ошибка. Проверьте подключение к интернету.';
    }
}
