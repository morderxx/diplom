const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const pool     = require('./db');
const router   = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Универсальный middleware для защищённых роутов
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token provided');
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // теперь payload содержит и id, и login
    req.userLogin = payload.login;
    req.userId    = payload.id;
    next();
  } catch (e) {
    console.error('JWT error:', e);
    res.status(401).send('Invalid token');
  }
}

// Регистрация
router.post('/register', async (req, res) => {
  const { login, pass, keyword } = req.body;
  if (!login || !pass || !keyword) return res.status(400).send('Missing fields');

  try {
    const hashedPass = await bcrypt.hash(pass, 10);
    const key = require('crypto').randomBytes(32).toString('hex');
    await pool.query(
      'INSERT INTO users (login, pass, key, keyword) VALUES ($1,$2,$3,$4)',
      [login, hashedPass, key, keyword]
    );
    res.sendStatus(201);
  } catch (err) {
    console.error('Registration error:', err);
    res.sendStatus(500);
  }
});

// Логин
router.post('/login', async (req, res) => {
  const { login, pass } = req.body;
  if (!login || !pass) return res.status(400).send('Missing fields');

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
    if (rows.length === 0) return res.status(400).send('User not found');

    const user = rows[0];
    if (!await bcrypt.compare(pass, user.pass)) {
      return res.status(400).send('Invalid password');
    }

    // Восстанавливаем payload.id чтобы фильтры работали
    const token = jwt.sign(
      { id: user.id, login: user.login },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.sendStatus(500);
  }
});

// Сохранение профиля
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
        WHERE login = $5`,
      [nickname, full_name, age, bio, req.userLogin]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('Profile save error:', err);
    res.sendStatus(500);
  }
});

// Получение профиля
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT nickname, full_name, age, bio FROM users WHERE login = $1',
      [req.userLogin]
    );
    res.json(rows[0] || {});
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.sendStatus(500);
  }
});

module.exports = router;
