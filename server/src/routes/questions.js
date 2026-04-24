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

// GET /api/questions?company=&type=&search=&source=
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { company, type: qType, search, source } = req.query;
    let where = ['user_id = ?'];
    let params = [req.user.id];

    if (company) { where.push('company LIKE ?'); params.push(`%${company}%`); }
    if (qType) { where.push('question_type = ?'); params.push(qType); }
    if (source) { where.push('source = ?'); params.push(source); }
    if (search) { where.push('(question LIKE ? OR answer LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

    const w = `WHERE ${where.join(' AND ')}`;
    const result = db.exec(
      `SELECT * FROM interview_questions ${w} ORDER BY created_at DESC`,
      params
    );
    res.json(parseRows(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/questions
router.post('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { company, position, question_type, question, answer, difficulty, tags, interview_date, source } = req.body;
    if (!question) return res.status(400).json({ error: '题目不能为空' });

    db.run(
      `INSERT INTO interview_questions (user_id, company, position, question_type, question, answer, difficulty, tags, interview_date, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, company || '', position || '', question_type || '', question, answer || '', difficulty || 3, tags || '', interview_date || '', source || '']
    );
    saveDb();
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/questions/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const existing = db.exec('SELECT * FROM interview_questions WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    const cols = existing[0].columns;
    const cur = {};
    cols.forEach((c, i) => cur[c] = existing[0].values[0][i]);

    const b = req.body;
    db.run(
      `UPDATE interview_questions SET company=?, position=?, question_type=?, question=?,
        answer=?, difficulty=?, tags=?, interview_date=?, source=?,
        updated_at=datetime('now','localtime') WHERE id=? AND user_id=?`,
      [b.company ?? cur.company, b.position ?? cur.position, b.question_type ?? cur.question_type,
        b.question || cur.question, b.answer ?? cur.answer, b.difficulty ?? cur.difficulty,
        b.tags ?? cur.tags, b.interview_date ?? cur.interview_date, b.source ?? cur.source,
        id, req.user.id]
    );
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/questions/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    db.run('DELETE FROM interview_questions WHERE id = ? AND user_id = ?', [parseInt(req.params.id), req.user.id]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
