const express = require('express');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).send('No token');
    try {
        const token = auth.split(' ')[1];
        const payload = jwt.verify(token, JWT_SECRET);
        req.userLogin = payload.login;
        next();
    } catch (err) {
        res.status(401).send('Invalid token');
    }
}

router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT login FROM users');
        res.json(result.rows.map(u => u.login));
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching users');
    }
});

module.exports = router;
