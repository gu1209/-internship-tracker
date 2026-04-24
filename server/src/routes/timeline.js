const express = require('express');
const { getDb, saveDb } = require('../db');

const router = express.Router();

// GET /api/timeline?application_id=
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { application_id } = req.query;
    const userId = req.user.id;

    let sql = `SELECT t.*, a.company, a.position FROM timeline t
               LEFT JOIN applications a ON t.application_id = a.id
               WHERE t.user_id = ?`;
    let params = [userId];

    if (application_id) {
      sql += ' AND t.application_id = ?';
      params.push(parseInt(application_id));
    }

    sql += ' ORDER BY t.event_date DESC, t.id DESC';

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

// POST /api/timeline
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { application_id, event_date, event_type, description } = req.body;
    const userId = req.user.id;

    if (!application_id || !event_date || !event_type) {
      return res.status(400).json({ error: 'application_id, event_date, event_type are required' });
    }

    db.run(
      `INSERT INTO timeline (user_id, application_id, event_date, event_type, description) VALUES (?, ?, ?, ?, ?)`,
      [userId, parseInt(application_id), event_date, event_type, description || '']
    );

    saveDb();
    const idResult = db.exec('SELECT last_insert_rowid()');
    res.status(201).json({ id: idResult[0].values[0][0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/timeline/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const userId = req.user.id;
    const existing = db.exec('SELECT * FROM timeline WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const columns = existing[0].columns;
    const current = {};
    columns.forEach((col, i) => current[col] = existing[0].values[0][i]);

    const { event_date, event_type, description } = req.body;

    db.run(
      `UPDATE timeline SET event_date=?, event_type=?, description=? WHERE id=? AND user_id=?`,
      [event_date || current.event_date, event_type || current.event_type,
       description !== undefined ? description : current.description, id, userId]
    );

    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/timeline/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const userId = req.user.id;
    db.run('DELETE FROM timeline WHERE id = ? AND user_id = ?', [id, userId]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
