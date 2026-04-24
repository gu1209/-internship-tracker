const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/report/weekly
router.get('/weekly', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const now = new Date();
    const weekAgo = new Date(now - 7 * 86400000);
    const start = weekAgo.toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];

    // New applications this week
    const newApps = db.exec(
      `SELECT company, position, delivery_date, status FROM applications
       WHERE user_id = ? AND delivery_date >= ? AND delivery_date <= ?
       ORDER BY delivery_date`,
      [userId, start, end]
    );
    const appCols = newApps.length > 0 ? newApps[0].columns : [];
    const applications = newApps.length > 0 ? newApps[0].values.map(v => {
      const obj = {};
      appCols.forEach((c, i) => obj[c] = v[i]);
      return obj;
    }) : [];

    // Status changes this week
    const timelineResult = db.exec(
      `SELECT t.event_date, t.event_type, t.description FROM timeline t
       WHERE t.user_id = ? AND t.event_date >= ? AND t.event_date <= ?
       AND t.event_type != '投递'
       ORDER BY t.event_date`,
      [userId, start, end]
    );
    const tlCols = timelineResult.length > 0 ? timelineResult[0].columns : [];
    const statusChanges = timelineResult.length > 0 ? timelineResult[0].values.map(v => {
      const obj = {};
      tlCols.forEach((c, i) => obj[c] = v[i]);
      return obj;
    }) : [];

    // Overall stats
    const totalResult = db.exec('SELECT COUNT(*) FROM applications WHERE user_id = ?', [userId]);
    const total = totalResult[0]?.values[0]?.[0] || 0;

    const statusResult = db.exec('SELECT status, COUNT(*) FROM applications WHERE user_id = ? GROUP BY status', [userId]);
    const statusDist = {};
    if (statusResult.length > 0) {
      statusResult[0].values.forEach(v => { statusDist[v[0]] = v[1]; });
    }

    const offers = statusDist['offer'] || 0;

    // Todos completed this week
    const todosDone = db.exec(
      `SELECT COUNT(*) FROM todos WHERE user_id = ? AND done = 1`,
      [userId]
    );

    // Upcoming interviews
    const interviews = db.exec(
      `SELECT company, position, interview_date FROM applications
       WHERE user_id = ? AND interview_date >= ? AND interview_date != ''
       ORDER BY interview_date LIMIT 10`,
      [userId, end]
    );
    const intCols = interviews.length > 0 ? interviews[0].columns : [];
    const upcomingInterviews = interviews.length > 0 ? interviews[0].values.map(v => {
      const obj = {};
      intCols.forEach((c, i) => obj[c] = v[i]);
      return obj;
    }) : [];

    const report = {
      weekStart: start,
      weekEnd: end,
      newApplications: applications.length,
      total,
      statusDist,
      offers,
      statusChanges,
      applications,
      completedTodos: todosDone[0]?.values[0]?.[0] || 0,
      upcomingInterviews,
    };

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
