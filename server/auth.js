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
        await pool.query(
            'INSERT INTO users (login, pass, key, keyword) VALUES ($1, $2, $3, $4)',
            [login, hashedPass, key, keyword]
        );
        res.status(201).send('User registered');
    } catch (err) {
        console.error(err);
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
        console.error(err);
        res.status(500).send('Login error');
    }
});

module.exports = router;
