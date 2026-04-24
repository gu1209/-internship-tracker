const express = require('express');
const { getDb, saveDb } = require('../db');

const router = express.Router();

// GET /api/todos?done=&application_id=&overdue=
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { done, application_id, overdue } = req.query;
    const userId = req.user.id;

    let where = ['t.user_id = ?'];
    let params = [userId];

    if (done !== undefined) {
      where.push('t.done = ?');
      params.push(parseInt(done));
    }
    if (application_id) {
      where.push('t.application_id = ?');
      params.push(parseInt(application_id));
    }
    if (overdue === '1') {
      const today = new Date().toISOString().split('T')[0];
      where.push('t.due_date < ? AND t.done = 0');
      params.push(today);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const sql = `SELECT t.*, a.company, a.position FROM todos t
                 LEFT JOIN applications a ON t.application_id = a.id
                 ${whereClause}
                 ORDER BY t.due_date ASC`;

    const result = db.exec(sql, params);
    const columns = result.length > 0 ? result[0].columns : [];
    const rows = result.length > 0 ? result[0].values.map(v => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = v[i]);
      return obj;
    }) : [];

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/todos
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { application_id, description, due_date } = req.body;
    const userId = req.user.id;

    if (!description || !due_date) {
      return res.status(400).json({ error: 'description and due_date are required' });
    }

    db.run(
      `INSERT INTO todos (user_id, application_id, description, due_date) VALUES (?, ?, ?, ?)`,
      [userId, application_id ? parseInt(application_id) : null, description, due_date]
    );

    saveDb();
    const idResult = db.exec('SELECT last_insert_rowid()');
    res.status(201).json({ id: idResult[0].values[0][0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/todos/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const userId = req.user.id;
    const existing = db.exec('SELECT * FROM todos WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const columns = existing[0].columns;
    const current = {};
    columns.forEach((col, i) => current[col] = existing[0].values[0][i]);

    const { application_id, description, due_date, done } = req.body;

    db.run(
      `UPDATE todos SET application_id=?, description=?, due_date=?, done=? WHERE id=? AND user_id=?`,
      [
        application_id !== undefined ? (application_id ? parseInt(application_id) : null) : current.application_id,
        description || current.description,
        due_date || current.due_date,
        done !== undefined ? parseInt(done) : current.done,
        id, userId
      ]
    );

    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/todos/:id/toggle
router.patch('/:id/toggle', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const userId = req.user.id;
    const existing = db.exec('SELECT done FROM todos WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const currentDone = existing[0].values[0][0];
    db.run('UPDATE todos SET done = ? WHERE id = ? AND user_id = ?', [currentDone ? 0 : 1, id, userId]);

    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const userId = req.user.id;
    db.run('DELETE FROM todos WHERE id = ? AND user_id = ?', [id, userId]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
