// Пример для Express.js
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.get('/proxy', async (req, res) => {
  try {
    const url = decodeURIComponent(req.query.url);
    const response = await fetch(url);
    const data = await response.text();
    res.set('Content-Type', response.headers.get('Content-Type'));
    res.send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy error');
  }
});
