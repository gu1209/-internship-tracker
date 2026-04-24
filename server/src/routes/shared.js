const express = require('express');
const { getDb } = require('../db');
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

// Build a map of { userId -> { source, sourceName, can_view_questions, can_view_ratings } }
// that the current user can view.
function buildAccessMap(db, userId) {
  const accessMap = {};

  // 1. Friend-based access
  const friendRels = db.exec(`
    SELECT f.id AS rel_id, f.user_id, f.friend_id, u.username
    FROM friends f
    JOIN users u ON CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END = u.id
    WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
  `, [userId, userId, userId]);

  if (friendRels.length > 0) {
    const fCols = friendRels[0].columns;
    for (const row of friendRels[0].values) {
      const rel = {};
      fCols.forEach((c, i) => rel[c] = row[i]);
      const otherId = rel.user_id === userId ? rel.friend_id : rel.user_id;
      const otherUsername = rel.username;

      // Find OTHER user's permissions for this relationship (what they share with me)
      const perms = db.exec(
        'SELECT can_view_questions, can_view_ratings FROM friend_permissions WHERE relationship_id = ? AND owner_id = ?',
        [rel.rel_id, otherId]
      );
      const cq = perms.length > 0 && perms[0].values.length > 0 ? perms[0].values[0][0] : 1;
      const cr = perms.length > 0 && perms[0].values.length > 0 ? perms[0].values[0][1] : 1;

      if (cq || cr) {
        accessMap[otherId] = {
          source: 'friend',
          sourceName: otherUsername,
          can_view_questions: cq,
          can_view_ratings: cr,
        };
      }
    }
  }

  // 2. Group-based access
  const myGroups = db.exec(`
    SELECT g.id, g.name
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
  `, [userId]);

  if (myGroups.length > 0) {
    const gCols = myGroups[0].columns;
    for (const row of myGroups[0].values) {
      const group = {};
      gCols.forEach((c, i) => group[c] = row[i]);

      // Get all other members' permissions in this group
      const memberPerms = db.exec(`
        SELECT gm.user_id, u.username, gp.can_view_questions, gp.can_view_ratings
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        LEFT JOIN group_permissions gp ON gp.group_id = gm.group_id AND gp.owner_id = gm.user_id
        WHERE gm.group_id = ? AND gm.user_id != ?
      `, [group.id, userId]);

      if (memberPerms.length > 0) {
        const mpCols = memberPerms[0].columns;
        for (const mrow of memberPerms[0].values) {
          const mp = {};
          mpCols.forEach((c, i) => mp[c] = mrow[i]);
          const otherId = mp.user_id;
          const cq = mp.can_view_questions ?? 1;
          const cr = mp.can_view_ratings ?? 1;

          if (cq || cr) {
            if (!accessMap[otherId]) {
              accessMap[otherId] = {
                source: 'group',
                sourceName: group.name,
                can_view_questions: cq,
                can_view_ratings: cr,
              };
            } else {
              // If already accessible via friend, also add group access info
              // Merge: if either source allows, allow
              accessMap[otherId].can_view_questions = accessMap[otherId].can_view_questions || cq;
              accessMap[otherId].can_view_ratings = accessMap[otherId].can_view_ratings || cr;
            }
          }
        }
      }
    }
  }

  return accessMap;
}

// GET /api/shared/sources — list of content sources I can view
router.get('/sources', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const accessMap = buildAccessMap(db, req.user.id);

    const friends = [];
    const groups = [];
    for (const [uid, info] of Object.entries(accessMap)) {
      const entry = { user_id: parseInt(uid), username: info.sourceName, ...info };
      if (info.source === 'friend') friends.push(entry);
      else groups.push(entry);
    }
    res.json({ friends, groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shared/questions?owner_id= — shared interview questions
router.get('/questions', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const accessMap = buildAccessMap(db, req.user.id);
    const ownerId = req.query.owner_id ? parseInt(req.query.owner_id) : null;

    let allowedIds = Object.entries(accessMap)
      .filter(([, info]) => info.can_view_questions)
      .map(([uid]) => parseInt(uid));

    if (ownerId) {
      allowedIds = allowedIds.filter(id => id === ownerId);
    }

    if (allowedIds.length === 0) {
      return res.json([]);
    }

    const placeholders = allowedIds.map(() => '?').join(',');
    const result = db.exec(`
      SELECT iq.*, u.username AS _owner_username
      FROM interview_questions iq
      JOIN users u ON iq.user_id = u.id
      WHERE iq.user_id IN (${placeholders})
      ORDER BY iq.created_at DESC
      LIMIT 200
    `, allowedIds);

    const rows = parseRows(result);
    // Enrich with source info
    rows.forEach(row => {
      const info = accessMap[row.user_id];
      if (info) {
        row._source = info.source;
        row._source_name = info.sourceName;
      }
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shared/ratings?owner_id= — shared company ratings
router.get('/ratings', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const accessMap = buildAccessMap(db, req.user.id);
    const ownerId = req.query.owner_id ? parseInt(req.query.owner_id) : null;

    let allowedIds = Object.entries(accessMap)
      .filter(([, info]) => info.can_view_ratings)
      .map(([uid]) => parseInt(uid));

    if (ownerId) {
      allowedIds = allowedIds.filter(id => id === ownerId);
    }

    if (allowedIds.length === 0) {
      return res.json([]);
    }

    const placeholders = allowedIds.map(() => '?').join(',');
    const result = db.exec(`
      SELECT cr.*, u.username AS _owner_username
      FROM company_ratings cr
      JOIN users u ON cr.user_id = u.id
      WHERE cr.user_id IN (${placeholders})
      ORDER BY cr.created_at DESC
      LIMIT 200
    `, allowedIds);

    const rows = parseRows(result);
    rows.forEach(row => {
      const info = accessMap[row.user_id];
      if (info) {
        row._source = info.source;
        row._source_name = info.sourceName;
      }
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
