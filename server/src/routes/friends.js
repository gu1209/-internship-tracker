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

// GET /api/friends/search?username=  — must be before /:id routes
router.get('/search', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { username } = req.query;
    if (!username || username.trim().length === 0) {
      return res.json([]);
    }
    const result = db.exec(
      'SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 20',
      [`%${username.trim()}%`, req.user.id]
    );
    res.json(parseRows(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/friends — list all friend relationships for current user
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    // Bidirectional: find rows where I am user_id OR friend_id
    const result = db.exec(`
      SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at,
        CASE WHEN f.user_id = ? THEN u2.username ELSE u1.username END AS friend_username,
        CASE WHEN f.friend_id = ? THEN 'incoming' ELSE 'outgoing' END AS direction
      FROM friends f
      JOIN users u1 ON f.user_id = u1.id
      JOIN users u2 ON f.friend_id = u2.id
      WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status != 'blocked'
      ORDER BY f.created_at DESC
    `, [userId, userId, userId, userId]);
    res.json(parseRows(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/friends — send friend request by username
router.post('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: '请输入用户名' });

    // Find target user
    const users = db.exec('SELECT id, username FROM users WHERE username = ?', [username]);
    if (users.length === 0 || users[0].values.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const targetId = users[0].values[0][0];
    if (targetId === req.user.id) {
      return res.status(400).json({ error: '不能添加自己为好友' });
    }

    // Check existing relationship
    const existing = db.exec(
      'SELECT id, status FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [req.user.id, targetId, targetId, req.user.id]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      const status = existing[0].values[0][1];
      if (status === 'accepted') return res.status(400).json({ error: '已是好友' });
      if (status === 'pending') return res.status(400).json({ error: '已发送过好友请求' });
    }

    // Create friend request
    db.run('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)', [req.user.id, targetId, 'pending']);
    const idResult = db.exec('SELECT last_insert_rowid()');
    const relId = idResult[0].values[0][0];

    // Create default permissions for the requester (what the target can see from me)
    try {
      db.run('INSERT INTO friend_permissions (relationship_id, owner_id, can_view_questions, can_view_ratings) VALUES (?, ?, 1, 1)', [relId, req.user.id]);
    } catch (e) { /* ignore duplicate */ }

    saveDb();
    res.status(201).json({ ok: true, id: relId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/friends/:id/accept — accept a pending request (must be the target)
router.put('/:id/accept', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const relId = parseInt(req.params.id);
    const rel = db.exec('SELECT * FROM friends WHERE id = ?', [relId]);
    if (rel.length === 0 || rel[0].values.length === 0) {
      return res.status(404).json({ error: '请求不存在' });
    }
    const cols = rel[0].columns;
    const row = {};
    cols.forEach((c, i) => row[c] = rel[0].values[0][i]);

    if (row.friend_id !== req.user.id) {
      return res.status(403).json({ error: '无权操作' });
    }
    if (row.status !== 'pending') {
      return res.status(400).json({ error: '该请求已处理' });
    }

    db.run('UPDATE friends SET status = ? WHERE id = ?', ['accepted', relId]);

    // Create default permissions for the accepter (what the requester can see from me)
    try {
      db.run('INSERT INTO friend_permissions (relationship_id, owner_id, can_view_questions, can_view_ratings) VALUES (?, ?, 1, 1)', [relId, req.user.id]);
    } catch (e) { /* ignore duplicate */ }

    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/friends/:id/reject — reject/delete a friend request
router.put('/:id/reject', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const relId = parseInt(req.params.id);
    const rel = db.exec('SELECT * FROM friends WHERE id = ?', [relId]);
    if (rel.length === 0 || rel[0].values.length === 0) {
      return res.status(404).json({ error: '请求不存在' });
    }
    const cols = rel[0].columns;
    const row = {};
    cols.forEach((c, i) => row[c] = rel[0].values[0][i]);

    // Only the target can reject
    if (row.friend_id !== req.user.id && row.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权操作' });
    }

    db.run('DELETE FROM friends WHERE id = ?', [relId]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/friends/:id/permissions — get my permissions for this friend relationship
router.get('/:id/permissions', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const relId = parseInt(req.params.id);
    // Verify I'm part of this relationship
    const rel = db.exec('SELECT * FROM friends WHERE id = ? AND (user_id = ? OR friend_id = ?)', [relId, req.user.id, req.user.id]);
    if (rel.length === 0 || rel[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const permResult = db.exec(
      'SELECT can_view_questions, can_view_ratings FROM friend_permissions WHERE relationship_id = ? AND owner_id = ?',
      [relId, req.user.id]
    );
    if (permResult.length === 0 || permResult[0].values.length === 0) {
      return res.json({ can_view_questions: 1, can_view_ratings: 1 });
    }
    const perms = parseRows(permResult)[0];
    res.json(perms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/friends/:id/permissions — update my permissions for this friend relationship
router.put('/:id/permissions', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const relId = parseInt(req.params.id);
    const rel = db.exec('SELECT * FROM friends WHERE id = ? AND (user_id = ? OR friend_id = ?)', [relId, req.user.id, req.user.id]);
    if (rel.length === 0 || rel[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const { can_view_questions, can_view_ratings } = req.body;
    const cq = can_view_questions === undefined ? 1 : (can_view_questions ? 1 : 0);
    const cr = can_view_ratings === undefined ? 1 : (can_view_ratings ? 1 : 0);

    // Upsert permissions
    const existing = db.exec(
      'SELECT id FROM friend_permissions WHERE relationship_id = ? AND owner_id = ?',
      [relId, req.user.id]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run('UPDATE friend_permissions SET can_view_questions = ?, can_view_ratings = ? WHERE relationship_id = ? AND owner_id = ?', [cq, cr, relId, req.user.id]);
    } else {
      db.run('INSERT INTO friend_permissions (relationship_id, owner_id, can_view_questions, can_view_ratings) VALUES (?, ?, ?, ?)', [relId, req.user.id, cq, cr]);
    }
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/friends/:id — remove a friend relationship
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const relId = parseInt(req.params.id);
    const rel = db.exec('SELECT * FROM friends WHERE id = ? AND (user_id = ? OR friend_id = ?)', [relId, req.user.id, req.user.id]);
    if (rel.length === 0 || rel[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    db.run('DELETE FROM friends WHERE id = ?', [relId]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
