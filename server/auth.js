// server/auth.js
const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const pool     = require('./db');
const router   = express.Router();
const crypto   = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

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
    req.userId    = payload.id;
    req.userLogin = payload.login;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// Сохранение или обновление профиля
router.post('/profile', authMiddleware, async (req, res) => {
  const { nickname, full_name, age, bio } = req.body;
  if (!nickname || !full_name || !age || !bio) {
    return res.status(400).send('Missing profile fields');
  }

  try {
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
    
    // Обработка ошибки дублирования никнейма
    if (err.code === '23505') {
      return res.status(400).json({ 
        error: 'duplicate_nickname',
        message: 'Этот никнейм уже занят. Пожалуйста, выберите другой.' 
      });
    }
    
    res.status(500).send('Error saving profile');
  }
});

// GET /api/profile — вернуть профиль
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT nickname, full_name, age, bio
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

// Сброс пароля
router.post('/reset-password', async (req, res) => {
    const { login, keyword, newPassword } = req.body;
    if (!login || !keyword || !newPassword) {
        return res.status(400).json({ message: 'Missing fields' });
    }

    try {
        // Найдем пользователя по логину и ключевому слову
        const userRes = await pool.query(
            `SELECT id, keyword FROM secret_profile WHERE login = $1`,
            [login]
        );

        if (userRes.rows.length === 0) {
            return res.status(400).json({ message: 'Пользователь не найден' });
        }

        const user = userRes.rows[0];
        
        // Проверяем ключевое слово
        if (user.keyword !== keyword) {
            return res.status(400).json({ message: 'Неверное ключевое слово' });
        }

        // Хешируем новый пароль
        const hashedPass = await bcrypt.hash(newPassword, 10);
        
        // Обновляем пароль
        await pool.query(
            `UPDATE secret_profile SET pass = $1 WHERE id = $2`,
            [hashedPass, user.id]
        );

        res.json({ message: 'Пароль успешно изменен' });
    } catch (err) {
        console.error('Password reset error:', err);
        res.status(500).json({ message: 'Error resetting password' });
    }
});

module.exports = router;
