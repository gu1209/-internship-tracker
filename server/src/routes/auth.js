const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, saveDb } = require('../db');

const router = express.Router();
const { JWT_SECRET } = require('../config');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度 3-20 个字符' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 个字符' });
    }

    const db = getDb();

    // Check if username exists
    const existing = db.exec('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password_hash, is_admin, approved) VALUES (?, ?, 0, 0)', [username, hash]);
    saveDb();

    res.status(201).json({ message: '注册成功，请等待管理员审批' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const db = getDb();
    const result = db.exec('SELECT id, username, password_hash, is_admin, approved FROM users WHERE username = ?', [username]);
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const [id, uname, hash, isAdmin, approved] = result[0].values[0];

    if (!approved) {
      return res.status(403).json({ error: '账号尚未通过审批，请等待管理员审核' });
    }

    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ id, username: uname, is_admin: !!isAdmin }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id, username: uname, is_admin: !!isAdmin } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  res.json(req.user);
});

module.exports = { router };
