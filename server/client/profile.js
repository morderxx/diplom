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

    // Проверка формата никнейма
    if (!nickname.startsWith('@')) {
        document.getElementById('message').innerText = 'Никнейм должен начинаться с @';
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

        if (res.ok) {
            localStorage.setItem('nickname', nickname);
            document.getElementById('message').innerText = 'Профиль сохранён!';
            setTimeout(() => {
                window.location.href = 'chat.html';
            }, 1000);
        } else {
            try {
                const errorData = await res.json();
                
                // Обработка ошибки дублирования никнейма по тексту ошибки
                if (errorData.error?.detail?.includes('already exists') || 
                    errorData.error?.detail?.includes('nickname') || 
                    errorData.error?.code === '23505' || 
                    errorData.error?.constraint === 'idx_users_nickname' ||
                    (errorData.error && errorData.error.includes('duplicate key'))) {
                    document.getElementById('message').innerText = 
                        'Этот никнейм уже занят. Пожалуйста, выберите другой.';
                } 
                // Обработка других ошибок
                else {
                    document.getElementById('message').innerText = 
                        `Ошибка сохранения: ${errorData.error?.message || errorData.message || 'Неизвестная ошибка'}`;
                }
            } 
            // Если не удалось распарсить JSON, анализируем текст ошибки
            catch (parseError) {
                const errorText = await res.text();
                
                // Проверяем текст ошибки на наличие признаков дублирования
                if (errorText.includes('duplicate key') || 
                    errorText.includes('nickname') || 
                    errorText.includes('23505') || 
                    errorText.includes('already exists')) {
                    document.getElementById('message').innerText = 
                        'Этот никнейм уже занят. Пожалуйста, выберите другой.';
                } else {
                    document.getElementById('message').innerText = 
                        `Ошибка сохранения профиля (${res.status}): ${errorText || 'Нет дополнительной информации'}`;
                }
            }
        }
    } catch (error) {
        console.error('Сетевая ошибка:', error);
        document.getElementById('message').innerText = 
            'Сетевая ошибка. Проверьте подключение к интернету.';
    }
}
