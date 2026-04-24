const express = require('express');
const { getDb, saveDb } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function parseRows(result) {
  if (result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map(v => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = v[i]);
    return obj;
  });
}

// GET /api/resume
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(
      `SELECT * FROM resume_versions WHERE user_id = ? ORDER BY updated_at DESC`,
      [req.user.id]
    );
    res.json(parseRows(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/resume
router.post('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { version_name, target_position, content } = req.body;
    if (!version_name) return res.status(400).json({ error: '版本名不能为空' });

    db.run(
      `INSERT INTO resume_versions (user_id, version_name, target_position, content) VALUES (?, ?, ?, ?)`,
      [req.user.id, version_name, target_position || '', content || '']
    );
    saveDb();
    const idResult = db.exec('SELECT last_insert_rowid()');
    res.status(201).json({ id: idResult[0].values[0][0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/resume/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const existing = db.exec('SELECT * FROM resume_versions WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    const cols = existing[0].columns;
    const cur = {};
    cols.forEach((c, i) => cur[c] = existing[0].values[0][i]);

    const b = req.body;
    db.run(
      `UPDATE resume_versions SET version_name=?, target_position=?, content=?,
        updated_at=datetime('now','localtime') WHERE id=? AND user_id=?`,
      [b.version_name || cur.version_name, b.target_position ?? cur.target_position,
        b.content ?? cur.content, id, req.user.id]
    );
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/resume/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    db.run('DELETE FROM resume_versions WHERE id = ? AND user_id = ?', [parseInt(req.params.id), req.user.id]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
