const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Регистрация
router.post('/register', async (req, res) => {
    const { login, pass, keyword } = req.body;
    if (!login || !pass || !keyword) {
        return res.status(400).send('Missing fields');
    }

    const hashedPass = await bcrypt.hash(pass, 10);
    const key = require('crypto').randomBytes(32).toString('hex');

    try {
        // Вставляем пользователя, без создания отдельной таблицы
        await pool.query(
            'INSERT INTO users (login, pass, key, keyword) VALUES ($1, $2, $3, $4)',
            [login, hashedPass, key, keyword]
        );
        res.status(201).send('User registered');
    } catch (err) {
        console.error('Registration error:', err);
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
        const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
        if (result.rows.length === 0) {
            return res.status(400).send('User not found');
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(pass, user.pass);

        if (!match) {
            return res.status(400).send('Invalid password');
        }

        const token = jwt.sign({ id: user.id, login: user.login }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).send('Login error');
    }
});

// Обновление профиля — теперь пишем прямо в таблицу users
router.post('/profile', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('No token provided');
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        const { nickname, full_name, age, bio } = req.body;

        if (!nickname || !full_name || !age || !bio) {
            return res.status(400).send('Missing profile fields');
        }

        await pool.query(
            `UPDATE users
                SET nickname  = $1,
                    full_name = $2,
                    age       = $3,
                    bio       = $4
              WHERE id = $5`,
            [nickname, full_name, age, bio, userId]
        );

        res.status(200).send('Profile saved');
    } catch (err) {
        console.error('Profile save error:', err);
        res.status(500).send('Error saving profile');
    }
});

module.exports = router;
