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

module.exports = router;
