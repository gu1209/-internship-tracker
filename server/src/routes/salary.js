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

// GET /api/salary
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(
      `SELECT * FROM salary_comparison WHERE user_id = ? ORDER BY total_package DESC`,
      [req.user.id]
    );
    res.json(parseRows(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/salary
router.post('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const {
      application_id, company, position, base_salary, bonus, stock, signing_bonus,
      allowance_meal, allowance_housing, other_benefits, total_package,
      work_hours, commute_minutes, notes
    } = req.body;

    if (!company) return res.status(400).json({ error: '公司名不能为空' });

    const calcTotal = (base_salary || 0) * 12 + (bonus || 0) + (stock || 0) + (signing_bonus || 0);
    const total = total_package || calcTotal;

    db.run(
      `INSERT INTO salary_comparison (user_id, application_id, company, position,
        base_salary, bonus, stock, signing_bonus, allowance_meal, allowance_housing,
        other_benefits, total_package, work_hours, commute_minutes, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, application_id || null, company, position || '',
        base_salary || 0, bonus || 0, stock || 0, signing_bonus || 0,
        allowance_meal || 0, allowance_housing || 0, other_benefits || '',
        total, work_hours || 0, commute_minutes || 0, notes || '']
    );
    saveDb();
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/salary/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const existing = db.exec('SELECT * FROM salary_comparison WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    const cols = existing[0].columns;
    const cur = {};
    cols.forEach((c, i) => cur[c] = existing[0].values[0][i]);

    const b = req.body;
    const base = b.base_salary ?? cur.base_salary;
    const bonusVal = b.bonus ?? cur.bonus;
    const stockVal = b.stock ?? cur.stock;
    const signing = b.signing_bonus ?? cur.signing_bonus;
    const calcTotal = base * 12 + bonusVal + stockVal + signing;
    const total = b.total_package || calcTotal;

    db.run(
      `UPDATE salary_comparison SET company=?, position=?, base_salary=?, bonus=?,
        stock=?, signing_bonus=?, allowance_meal=?, allowance_housing=?,
        other_benefits=?, total_package=?, work_hours=?, commute_minutes=?,
        notes=?, updated_at=datetime('now','localtime')
       WHERE id=? AND user_id=?`,
      [b.company || cur.company, b.position ?? cur.position, base, bonusVal,
        stockVal, signing, b.allowance_meal ?? cur.allowance_meal,
        b.allowance_housing ?? cur.allowance_housing, b.other_benefits ?? cur.other_benefits,
        total, b.work_hours ?? cur.work_hours, b.commute_minutes ?? cur.commute_minutes,
        b.notes ?? cur.notes, id, req.user.id]
    );
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/salary/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    db.run('DELETE FROM salary_comparison WHERE id = ? AND user_id = ?', [parseInt(req.params.id), req.user.id]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
