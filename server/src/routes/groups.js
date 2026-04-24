const express = require('express');
const crypto = require('crypto');
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

// GET /api/groups — list groups I belong to
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(`
      SELECT g.id, g.name, g.description, g.owner_id, g.invite_token, g.created_at,
        gm.role,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
      ORDER BY g.created_at DESC
    `, [req.user.id]);
    res.json(parseRows(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups — create a new group
router.post('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: '群组名称不能为空' });

    const token = crypto.randomBytes(16).toString('hex');
    db.run('INSERT INTO groups (owner_id, name, description, invite_token) VALUES (?, ?, ?, ?)',
      [req.user.id, name.trim(), description || '', token]);
    const idResult = db.exec('SELECT last_insert_rowid()');
    const groupId = idResult[0].values[0][0];

    // Owner is automatically a member
    db.run('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, req.user.id, 'owner']);

    // Default permissions for owner
    try {
      db.run('INSERT INTO group_permissions (group_id, owner_id, can_view_questions, can_view_ratings) VALUES (?, ?, 1, 1)', [groupId, req.user.id]);
    } catch (e) { /* ignore */ }

    saveDb();
    res.status(201).json({ ok: true, id: groupId, invite_token: token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id — group detail + members
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const groupId = parseInt(req.params.id);

    // Verify membership
    const memberCheck = db.exec(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, req.user.id]
    );
    if (memberCheck.length === 0 || memberCheck[0].values.length === 0) {
      return res.status(403).json({ error: '无权查看' });
    }

    // Group info
    const groupResult = db.exec('SELECT * FROM groups WHERE id = ?', [groupId]);
    if (groupResult.length === 0 || groupResult[0].values.length === 0) {
      return res.status(404).json({ error: '群组不存在' });
    }
    const group = parseRows(groupResult)[0];

    // Members
    const membersResult = db.exec(`
      SELECT gm.id AS membership_id, gm.user_id, u.username, gm.role, gm.joined_at
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.role DESC, gm.joined_at
    `, [groupId]);
    group.members = parseRows(membersResult);

    // My permissions
    const permResult = db.exec(
      'SELECT can_view_questions, can_view_ratings FROM group_permissions WHERE group_id = ? AND owner_id = ?',
      [groupId, req.user.id]
    );
    group.my_permissions = permResult.length > 0 && permResult[0].values.length > 0
      ? parseRows(permResult)[0]
      : { can_view_questions: 1, can_view_ratings: 1 };

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/join/:token — join a group via invite token
router.post('/join/:token', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { token } = req.params;
    const groupResult = db.exec('SELECT * FROM groups WHERE invite_token = ?', [token]);
    if (groupResult.length === 0 || groupResult[0].values.length === 0) {
      return res.status(404).json({ error: '邀请链接无效' });
    }
    const group = parseRows(groupResult)[0];

    // Check if already a member
    const existing = db.exec(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [group.id, req.user.id]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({ error: '你已在该群组中' });
    }

    db.run('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [group.id, req.user.id, 'member']);

    // Default permissions
    try {
      db.run('INSERT INTO group_permissions (group_id, owner_id, can_view_questions, can_view_ratings) VALUES (?, ?, 1, 1)', [group.id, req.user.id]);
    } catch (e) { /* ignore */ }

    saveDb();
    res.json({ ok: true, group_id: group.id, group_name: group.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id/permissions — get my permissions in this group
router.get('/:id/permissions', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const groupId = parseInt(req.params.id);
    const memberCheck = db.exec(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, req.user.id]
    );
    if (memberCheck.length === 0 || memberCheck[0].values.length === 0) {
      return res.status(403).json({ error: '无权查看' });
    }

    const permResult = db.exec(
      'SELECT can_view_questions, can_view_ratings FROM group_permissions WHERE group_id = ? AND owner_id = ?',
      [groupId, req.user.id]
    );
    if (permResult.length === 0 || permResult[0].values.length === 0) {
      return res.json({ can_view_questions: 1, can_view_ratings: 1 });
    }
    res.json(parseRows(permResult)[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/groups/:id/permissions — update my sharing permissions in this group
router.put('/:id/permissions', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const groupId = parseInt(req.params.id);
    const memberCheck = db.exec(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, req.user.id]
    );
    if (memberCheck.length === 0 || memberCheck[0].values.length === 0) {
      return res.status(403).json({ error: '无权操作' });
    }

    const { can_view_questions, can_view_ratings } = req.body;
    const cq = can_view_questions === undefined ? 1 : (can_view_questions ? 1 : 0);
    const cr = can_view_ratings === undefined ? 1 : (can_view_ratings ? 1 : 0);

    const existing = db.exec(
      'SELECT id FROM group_permissions WHERE group_id = ? AND owner_id = ?',
      [groupId, req.user.id]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run('UPDATE group_permissions SET can_view_questions = ?, can_view_ratings = ? WHERE group_id = ? AND owner_id = ?', [cq, cr, groupId, req.user.id]);
    } else {
      db.run('INSERT INTO group_permissions (group_id, owner_id, can_view_questions, can_view_ratings) VALUES (?, ?, ?, ?)', [groupId, req.user.id, cq, cr]);
    }
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/groups/:id/members/:userId — remove a member (owner only)
router.delete('/:id/members/:userId', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const groupId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);

    const group = db.exec('SELECT owner_id FROM groups WHERE id = ?', [groupId]);
    if (group.length === 0 || group[0].values.length === 0) {
      return res.status(404).json({ error: '群组不存在' });
    }
    if (group[0].values[0][0] !== req.user.id) {
      return res.status(403).json({ error: '只有群主可以移除成员' });
    }
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: '群主不能移除自己' });
    }

    db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, targetUserId]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/invite — regenerate invite token (owner only)
router.post('/:id/invite', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const groupId = parseInt(req.params.id);
    const group = db.exec('SELECT * FROM groups WHERE id = ? AND owner_id = ?', [groupId, req.user.id]);
    if (group.length === 0 || group[0].values.length === 0) {
      return res.status(403).json({ error: '只有群主可以重新生成邀请链接' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    db.run('UPDATE groups SET invite_token = ? WHERE id = ?', [token, groupId]);
    saveDb();
    res.json({ ok: true, invite_token: token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/groups/:id — delete group (owner only)
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const groupId = parseInt(req.params.id);
    const group = db.exec('SELECT * FROM groups WHERE id = ? AND owner_id = ?', [groupId, req.user.id]);
    if (group.length === 0 || group[0].values.length === 0) {
      return res.status(403).json({ error: '只有群主可以删除群组' });
    }

    db.run('DELETE FROM groups WHERE id = ?', [groupId]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
