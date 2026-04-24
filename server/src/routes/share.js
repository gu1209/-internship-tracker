const express = require('express');
const crypto = require('crypto');
const { getDb, saveDb } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Authenticated routes

router.get('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(
      `SELECT * FROM share_links WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    const cols = result.length > 0 ? result[0].columns : [];
    const rows = result.length > 0 ? result[0].values.map(v => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = v[i]);
      return obj;
    }) : [];
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const token = crypto.randomBytes(16).toString('hex');
    const { title, expire_date } = req.body;
    db.run(
      `INSERT INTO share_links (user_id, token, title, expire_date) VALUES (?, ?, ?, ?)`,
      [req.user.id, token, title || '', expire_date || '']
    );
    saveDb();
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({ token, url: `${baseUrl}/share/${token}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:token', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    db.run(
      `DELETE FROM share_links WHERE token = ? AND user_id = ?`,
      [req.params.token, req.user.id]
    );
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: GET /api/share/:token/data (no auth)
router.get('/:token/data', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(
      `SELECT * FROM share_links WHERE token = ?`,
      [req.params.token]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: '链接不存在或已过期' });
    }

    const cols = result[0].columns;
    const link = {};
    cols.forEach((c, i) => link[c] = result[0].values[0][i]);

    // Check expiry
    const today = new Date().toISOString().split('T')[0];
    if (link.expire_date && link.expire_date < today) {
      return res.status(403).json({ error: '链接已过期' });
    }

    // Increment view count
    db.run('UPDATE share_links SET view_count = view_count + 1 WHERE token = ?', [req.params.token]);
    saveDb();

    // Get applications for this user
    const appsResult = db.exec(
      `SELECT company, position, delivery_date, interview_date, status, notes FROM applications
       WHERE user_id = ? ORDER BY delivery_date DESC`,
      [link.user_id]
    );
    const appCols = appsResult.length > 0 ? appsResult[0].columns : [];
    const applications = appsResult.length > 0 ? appsResult[0].values.map(v => {
      const obj = {};
      appCols.forEach((c, i) => obj[c] = v[i]);
      return obj;
    }) : [];

    res.json({ title: link.title, applications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
