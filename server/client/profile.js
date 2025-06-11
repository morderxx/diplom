// server/client/profile.js
const API_URL = '/api';

// Текущий токен верификации
let verificationToken = '';

async function saveProfile() {
    const nickname = document.getElementById('nickname').value;
    const full_name = document.getElementById('full_name').value;
    const birthdate = document.getElementById('birthdate').value;
    const email = document.getElementById('email').value;
    const bio = document.getElementById('bio').value;
    const token = localStorage.getItem('token');

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
                birthdate, // Отправляем дату рождения
                bio,
                email
            })
        });

        const data = await res.json();
        
        if (res.ok) {
            // Сохраняем данные профиля
            localStorage.setItem('nickname', nickname);
            localStorage.setItem('email', email);
            
            // Показываем модальное окно
            document.getElementById('emailModal').style.display = 'block';
            document.getElementById('modalMessage').innerText = `На почту ${email} отправлен код подтверждения.`;
            
            // Генерируем и сохраняем код (в реальном приложении сервер бы отправил его)
            verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
            console.log('Код подтверждения (для теста):', verificationToken);
        } else {
            document.getElementById('message').innerText = data.message || 'Ошибка сохранения профиля';
        }
    } catch (err) {
        console.error('Ошибка:', err);
        document.getElementById('message').innerText = 'Ошибка сети';
    }
}

function closeModal() {
    document.getElementById('emailModal').style.display = 'none';
}

function moveToNext(current, nextId) {
    if (current.value.length === 1) {
        document.getElementById(nextId)?.focus();
    }
}

async function verifyEmail() {
    const code1 = document.getElementById('code1').value;
    const code2 = document.getElementById('code2').value;
    const code3 = document.getElementById('code3').value;
    const code4 = document.getElementById('code4').value;
    const code5 = document.getElementById('code5').value;
    const code6 = document.getElementById('code6').value;
    
    const enteredCode = code1 + code2 + code3 + code4 + code5 + code6;
    
    if (enteredCode === verificationToken) {
        document.getElementById('verifyMessage').innerText = 'Email успешно подтверждён!';
        document.getElementById('verifyMessage').style.color = 'green';
        
        setTimeout(() => {
            closeModal();
            window.location.href = 'chat.html';
        }, 1500);
    } else {
        document.getElementById('verifyMessage').innerText = 'Неверный код подтверждения';
        document.getElementById('verifyMessage').style.color = 'red';
    }
}

function resendCode() {
    // Генерируем новый код
    verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Новый код подтверждения (для теста):', verificationToken);
    
    document.getElementById('verifyMessage').innerText = 'Новый код отправлен!';
    document.getElementById('verifyMessage').style.color = 'green';
    
    // Очищаем поля ввода
    document.querySelectorAll('.verification-code input').forEach(input => {
        input.value = '';
    });
    document.getElementById('code1').focus();
}
