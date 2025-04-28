const API_URL = '/api';

async function saveProfile() {
  const nickname  = document.getElementById('nickname').value;
  const full_name = document.getElementById('full_name').value;
  const age       = document.getElementById('age').value;
  const bio       = document.getElementById('bio').value;
  const token     = localStorage.getItem('token');

  const res = await fetch(`${API_URL}/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ nickname, full_name, age, bio })
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
