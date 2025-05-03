// server/auth.js
const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const pool     = require('./db');
const router   = express.Router();
const crypto   = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

//
// Регистрация нового пользователя:
//   1) храним логин/пароль/ключи в secret_profile
//   2) создаём «пустой» профиль в users (id → secret_profile.id)
//
router.post('/register', async (req, res) => {
  const { login, pass, keyword } = req.body;
  if (!login || !pass || !keyword) {
    return res.status(400).send('Missing fields');
  }

  try {
    // Хешируем пароль
    const hashedPass = await bcrypt.hash(pass, 10);
    // Генерируем криптоключ
    const generatedKey = crypto.randomBytes(32).toString('hex');

    // 1) Вставляем секретную часть
    const spRes = await pool.query(
      `INSERT INTO secret_profile(login, pass, keyword, key)
         VALUES($1,$2,$3,$4)
      RETURNING id`,
      [login, hashedPass, keyword, generatedKey]
    );
    const userId = spRes.rows[0].id;

    // 2) Создаём соответствующую запись в users
    await pool.query(
      `INSERT INTO users(id) VALUES($1)`,
      [userId]
    );

    res.status(201).send('User registered');
  } catch (err) {
    console.error('Registration error:', err);
    // Дублирование login
    if (err.code === '23505') {
      return res.status(400).send('Login or keyword already in use');
    }
    res.status(500).send('Error registering user');
  }
});

//
// Логин: проверяем по secret_profile, возвращаем JWT { id, login }
//
router.post('/login', async (req, res) => {
  const { login, pass } = req.body;
  if (!login || !pass) {
    return res.status(400).send('Missing fields');
  }

  try {
    // Ищем в secret_profile
    const spRes = await pool.query(
      `SELECT id, pass FROM secret_profile WHERE login = $1`,
      [login]
    );
    if (spRes.rows.length === 0) {
      return res.status(400).send('User not found');
    }
    const { id, pass: hash } = spRes.rows[0];

    const match = await bcrypt.compare(pass, hash);
    if (!match) {
      return res.status(400).send('Invalid password');
    }

    // Генерируем токен с payload { id, login }
    const token = jwt.sign({ id, login }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Login error');
  }
});

//
// Middleware для всех /api/profile и других защищённых маршрутов
// проверяет JWT и кладёт в req.userId (и req.userLogin, если нужно)
//
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).send('No token provided');
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId    = payload.id;
    req.userLogin = payload.login;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

//
// Сохранение или обновление профиля (nickname, full_name, age, bio):
// данные лежат теперь в users
//
router.post('/profile', authMiddleware, async (req, res) => {
  const { nickname, full_name, age, bio } = req.body;
  if (!nickname || !full_name || !age || !bio) {
    return res.status(400).send('Missing profile fields');
  }

  try {
    // Обновляем поля в users по id
    await pool.query(
      `UPDATE users
          SET nickname  = $1,
              full_name = $2,
              age       = $3,
              bio       = $4
        WHERE id = $5`,
      [nickname, full_name, age, bio, req.userId]
    );
    res.status(200).send('Profile saved');
  } catch (err) {
    console.error('Profile save error:', err);
    res.status(500).send('Error saving profile');
  }
});

module.exports = router;
