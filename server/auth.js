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
        // Вставляем пользователя
        const result = await pool.query(
            'INSERT INTO users (login, pass, key, keyword) VALUES ($1, $2, $3, $4) RETURNING id',
            [login, hashedPass, key, keyword]
        );

        const userId = result.rows[0].id;

        // Создаём персональную таблицу для профиля
        const tableName = `user_${userId}`;
        await pool.query(`
            CREATE TABLE ${tableName} (
                id SERIAL PRIMARY KEY,
                nickname TEXT,
                full_name TEXT,
                age INTEGER,
                bio TEXT
            )
        `);

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

        const token = jwt.sign({ id: user.id, login: user.login }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).send('Login error');
    }
});

// Заполнение профиля
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

        const tableName = `user_${userId}`;

        await pool.query(
            `INSERT INTO ${tableName} (nickname, full_name, age, bio) VALUES ($1, $2, $3, $4)`,
            [nickname, full_name, age, bio]
        );

        res.status(200).send('Profile saved');
    } catch (err) {
        console.error('Profile save error:', err);
        res.status(500).send('Error saving profile');
    }
});

module.exports = router;
