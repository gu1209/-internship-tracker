const express = require('express');
const { getDb, saveDb } = require('../db');

const router = express.Router();

// GET /api/ratings
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(
      `SELECT * FROM company_ratings WHERE user_id = ? ORDER BY updated_at DESC`,
      [req.user.id]
    );
    const columns = result.length > 0 ? result[0].columns : [];
    const rows = result.length > 0 ? result[0].values.map(v => {
      const obj = {};
      columns.forEach((c, i) => obj[c] = v[i]);
      return obj;
    }) : [];
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ratings
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { company, application_id, rating, interview_stage, interview_notes, salary, tags } = req.body;
    if (!company) return res.status(400).json({ error: '公司名称不能为空' });

    db.run(
      `INSERT INTO company_ratings (user_id, company, application_id, rating, interview_stage, interview_notes, salary, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, company, application_id || null, rating || null, interview_stage || '', interview_notes || '', salary || '', tags || '']
    );
    saveDb();
    const idResult = db.exec('SELECT last_insert_rowid()');
    res.status(201).json({ id: idResult[0].values[0][0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ratings/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const { company, rating, interview_stage, interview_notes, salary, tags } = req.body;

    const existing = db.exec('SELECT * FROM company_ratings WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const cols = existing[0].columns;
    const cur = {};
    cols.forEach((c, i) => cur[c] = existing[0].values[0][i]);

    db.run(
      `UPDATE company_ratings SET company=?, rating=?, interview_stage=?, interview_notes=?, salary=?, tags=?, updated_at=datetime('now','localtime') WHERE id=? AND user_id=?`,
      [company || cur.company, rating || cur.rating, interview_stage !== undefined ? interview_stage : cur.interview_stage,
       interview_notes !== undefined ? interview_notes : cur.interview_notes,
       salary !== undefined ? salary : cur.salary, tags !== undefined ? tags : cur.tags, id, req.user.id]
    );
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ratings/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.run('DELETE FROM company_ratings WHERE id = ? AND user_id = ?', [parseInt(req.params.id), req.user.id]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
