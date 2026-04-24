const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, saveDb } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function adminOnly(req, res, next) {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

// GET /api/admin/users - list all users
router.get('/users', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(
      `SELECT id, username, is_admin, approved, created_at FROM users ORDER BY approved ASC, is_admin DESC, created_at DESC`
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

// PATCH /api/admin/users/:id/approve - approve a user
router.patch('/users/:id/approve', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const { approved } = req.body;
    const userId = parseInt(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({ error: '不能操作自己的账号' });
    }

    db.run('UPDATE users SET approved = ? WHERE id = ?', [approved ? 1 : 0, userId]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id - delete a user
router.delete('/users/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const userId = parseInt(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }

    db.run('DELETE FROM users WHERE id = ?', [userId]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id/reset-password - reset user password
router.patch('/users/:id/reset-password', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = getDb();
    const { password } = req.body;
    const userId = parseInt(req.params.id);

    if (!password || password.length < 6) {
      return res.status(400).json({ error: '新密码至少 6 个字符' });
    }

    const hash = await bcrypt.hash(password, 10);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
