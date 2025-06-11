// server/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Для теста - в реальном приложении используйте переменные окружения
const JWT_SECRET = 'your_jwt_secret_here';
const EMAIL_USER = 'zvonkicomplete@gmail.com';
const EMAIL_PASS = '5556122tima1234567';
const BASE_URL = 'diplom-production-8971.up.railway.app';

// Настройка почтового сервиса
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Регистрация нового пользователя
router.post('/register', async (req, res) => {
  const { login, pass, keyword } = req.body;
  if (!login || !pass || !keyword) {
    return res.status(400).send('Missing fields');
  }

  try {
    const hashedPass = await bcrypt.hash(pass, 10);
    const generatedKey = crypto.randomBytes(32).toString('hex');

    const spRes = await pool.query(
      `INSERT INTO secret_profile(login, pass, keyword, key)
         VALUES($1,$2,$3,$4)
       RETURNING id`,
      [login, hashedPass, keyword, generatedKey]
    );
    const userId = spRes.rows[0].id;

    await pool.query(
      `INSERT INTO users(id) VALUES($1)`,
      [userId]
    );

    res.status(201).send('User registered');
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === '23505') {
      return res.status(400).send('Login or keyword already in use');
    }
    res.status(500).send('Error registering user');
  }
});

// Логин
router.post('/login', async (req, res) => {
  const { login, pass } = req.body;
  if (!login || !pass) {
    return res.status(400).send('Missing fields');
  }

  try {
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

    const token = jwt.sign({ id, login }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Login error');
  }
});

// Middleware для защищённых маршрутов
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).send('No token provided');
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    req.userLogin = payload.login;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// Сохранение или обновление профиля
router.post('/profile', authMiddleware, async (req, res) => {
  const { nickname, full_name, birthdate, bio, email } = req.body; // Изменено с age на birthdate
  
  if (!nickname || !full_name || !birthdate || !bio || !email) {
    return res.status(400).send('Все поля обязательны');
  }

  // Проверка формата даты
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(birthdate)) {
    return res.status(400).send('Некорректный формат даты. Используйте YYYY-MM-DD');
  }

  try {
    // Генерация токена верификации
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Сохраняем дату рождения в поле age
    await pool.query(
      `UPDATE users
        SET nickname = $1,
            full_name = $2,
            age = $3,  // Используем дату рождения для поля age
            bio = $4,
            email = $5,
            email_verified = false,
            verification_token = $6
        WHERE id = $7`,
      [
        nickname, 
        full_name, 
        birthdate,  // Передаем дату рождения
        bio, 
        email, 
        verificationToken, 
        req.userId
      ]
    );

    // Отправка письма с подтверждением
    const verificationLink = `${BASE_URL}/verify-email?token=${verificationToken}&userId=${req.userId}`;
    
    const mailOptions = {
      from: EMAIL_USER,
      to: email,
      subject: 'Подтверждение email',
      html: `Нажмите <a href="${verificationLink}">здесь</a> для подтверждения почты`
    };

    // В реальном приложении раскомментировать
    await transporter.sendMail(mailOptions);
    console.log(`Verification link: ${verificationLink}`);
    
    res.status(200).json({ message: 'Письмо с подтверждением отправлено' });
  } catch (err) {
    console.error('Ошибка сохранения профиля:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Эндпоинт для подтверждения email
router.get('/verify-email', async (req, res) => {
  const { token, userId } = req.query;

  try {
    const result = await pool.query(
      `UPDATE users
        SET email_verified = true,
            verification_token = NULL
        WHERE id = $1 AND verification_token = $2
        RETURNING *`,
      [userId, token]
    );

    if (result.rows.length === 0) {
      return res.status(400).send('Неверная ссылка подтверждения');
    }

    res.send('Email успешно подтверждён!');
  } catch (err) {
    console.error('Ошибка верификации:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// GET профиля - возвращаем email и статус подтверждения
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT nickname, full_name, 
              TO_CHAR(age, 'YYYY-MM-DD') AS birthdate, // Конвертируем в строку
              bio, email, email_verified
         FROM users
        WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Profile not found');
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).send('Error fetching profile');
  }
});

module.exports = router;
