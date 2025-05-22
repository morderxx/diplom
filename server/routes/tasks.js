// server/routes/tasks.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../auth').middleware;

// Все роуты защищены
router.use(auth);

/**
 * GET /api/tasks
 * Вернёт все задачи пользователя
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await db.query(
      `SELECT id, text, done, due, tags, created_at, updated_at
         FROM tasks
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ tasks: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить задачи' });
  }
});

/**
 * POST /api/tasks/sync
 * Принимает { tasks: [...] } и перезаписывает БД
 */
router.post('/sync', async (req, res) => {
  const incoming = req.body.tasks;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Ожидается массив tasks' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tasks WHERE user_id = $1', [req.user.id]);

    if (incoming.length) {
      const stmt = `
        INSERT INTO tasks (user_id, text, done, due, tags)
        VALUES ${incoming.map((_, i) =>
          `($1, $${i*4+2}, $${i*4+3}, $${i*4+4}, $${i*4+5})`
        ).join(', ')}
      `;
      const flat = incoming.flatMap(t => [
        req.user.id,
        t.text,
        t.done,
        t.due,
        JSON.stringify(t.tags || [])
      ]);
      await client.query(stmt, flat);
    }

    await client.query('COMMIT');
    res.sendStatus(200);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Сбой при синхронизации' });
  } finally {
    client.release();
  }
});

module.exports = router;
