const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/analytics/overview
router.get('/overview', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    const totalResult = db.exec('SELECT COUNT(*) FROM applications WHERE user_id = ?', [userId]);
    const total = totalResult[0]?.values[0]?.[0] || 0;

    const statusResult = db.exec('SELECT status, COUNT(*) FROM applications WHERE user_id = ? GROUP BY status', [userId]);
    const statusDist = {};
    if (statusResult.length > 0) {
      statusResult[0].values.forEach(v => { statusDist[v[0]] = v[1]; });
    }

    const offers = statusDist['offer'] || 0;
    const pending = statusDist['已投递'] || 0;
    const responseRate = total > 0 ? ((total - pending) / total * 100).toFixed(1) : 0;
    const conversionRate = total > 0 ? (offers / total * 100).toFixed(1) : 0;

    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const todosResult = db.exec(
      `SELECT t.*, a.company, a.position FROM todos t
       LEFT JOIN applications a ON t.application_id = a.id
       WHERE t.user_id = ? AND t.due_date >= ? AND t.due_date <= ? AND t.done = 0
       ORDER BY t.due_date ASC LIMIT 10`,
      [userId, today, nextWeek]
    );
    const todoColumns = todosResult.length > 0 ? todosResult[0].columns : [];
    const upcomingTodos = todosResult.length > 0 ? todosResult[0].values.map(v => {
      const obj = {};
      todoColumns.forEach((col, i) => obj[col] = v[i]);
      return obj;
    }) : [];

    const overdueResult = db.exec(
      `SELECT COUNT(*) FROM todos WHERE user_id = ? AND due_date < ? AND done = 0`,
      [userId, today]
    );
    const overdueCount = overdueResult[0]?.values[0]?.[0] || 0;

    res.json({ total, statusDist, offers, responseRate, conversionRate, upcomingTodos, overdueCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/trend?range=30
router.get('/trend', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const range = parseInt(req.query.range) || 30;
    const startDate = new Date(Date.now() - range * 86400000).toISOString().split('T')[0];

    const result = db.exec(
      `SELECT delivery_date, COUNT(*) FROM applications
       WHERE user_id = ? AND delivery_date >= ?
       GROUP BY delivery_date ORDER BY delivery_date ASC`,
      [userId, startDate]
    );

    const columns = result.length > 0 ? result[0].columns : [];
    const rows = result.length > 0 ? result[0].values.map(v => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = v[i]);
      return obj;
    }) : [];

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/stale?days=7
router.get('/stale', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 7;
    const cutoffDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const result = db.exec(
      `SELECT id, company, position, status, delivery_date, updated_at,
        CAST(julianday('now') - julianday(updated_at) AS INTEGER) as stale_days
       FROM applications
       WHERE user_id = ? AND updated_at < ? AND status NOT IN ('offer', '拒信', '放弃')
       ORDER BY updated_at ASC`,
      [userId, cutoffDate]
    );

    const columns = result.length > 0 ? result[0].columns : [];
    const rows = result.length > 0 ? result[0].values.map(v => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = v[i]);
      return obj;
    }) : [];

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/rejection
router.get('/rejection', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    // Stage funnel
    const stageResult = db.exec(
      `SELECT status, COUNT(*) as cnt FROM applications WHERE user_id = ? GROUP BY status`,
      [userId]
    );
    const stageMap = {};
    if (stageResult.length > 0) {
      stageResult[0].values.forEach(v => { stageMap[v[0]] = v[1]; });
    }

    // Rejection stage breakdown
    const rejStageResult = db.exec(
      `SELECT rejection_stage, COUNT(*) as cnt FROM applications
       WHERE user_id = ? AND status = '拒信' AND rejection_stage != ''
       GROUP BY rejection_stage ORDER BY cnt DESC`,
      [userId]
    );
    const rejStages = [];
    if (rejStageResult.length > 0) {
      const cols = rejStageResult[0].columns;
      rejStageResult[0].values.forEach(v => {
        const obj = {};
        cols.forEach((c, i) => obj[c] = v[i]);
        rejStages.push(obj);
      });
    }

    // Rejection reason breakdown
    const rejReasonResult = db.exec(
      `SELECT rejection_reason, COUNT(*) as cnt FROM applications
       WHERE user_id = ? AND status = '拒信' AND rejection_reason != ''
       GROUP BY rejection_reason ORDER BY cnt DESC LIMIT 10`,
      [userId]
    );
    const rejReasons = [];
    if (rejReasonResult.length > 0) {
      const cols = rejReasonResult[0].columns;
      rejReasonResult[0].values.forEach(v => {
        const obj = {};
        cols.forEach((c, i) => obj[c] = v[i]);
        rejReasons.push(obj);
      });
    }

    // Company pass rate
    const companyResult = db.exec(
      `SELECT company, COUNT(*) as total,
        SUM(CASE WHEN status = 'offer' THEN 1 ELSE 0 END) as offers,
        SUM(CASE WHEN status = '拒信' THEN 1 ELSE 0 END) as rejections
       FROM applications WHERE user_id = ? GROUP BY company HAVING total >= 1 ORDER BY total DESC`,
      [userId]
    );
    const companies = [];
    if (companyResult.length > 0) {
      const cols = companyResult[0].columns;
      companyResult[0].values.forEach(v => {
        const obj = {};
        cols.forEach((c, i) => obj[c] = v[i]);
        obj.pass_rate = obj.total > 0 ? (obj.offers / obj.total * 100).toFixed(1) : 0;
        companies.push(obj);
      });
    }

    res.json({ stageMap, rejStages, rejReasons, companies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
