const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/calendar/events?month=2026-04
router.get('/events', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { month } = req.query;

    const events = [];

    // Applications with interview dates
    if (month) {
      const start = month + '-01';
      const end = month + '-31';
      const result = db.exec(
        `SELECT id, company, position, interview_date, status FROM applications
         WHERE user_id = ? AND interview_date >= ? AND interview_date <= ? AND interview_date != ''
         ORDER BY interview_date`,
        [userId, start, end]
      );
      if (result.length > 0) {
        result[0].values.forEach(v => {
          events.push({
            type: 'interview',
            id: v[0], company: v[1], position: v[2],
            date: v[3], status: v[4],
          });
        });
      }
    }

    // Todos by due date
    const todoQuery = month
      ? `SELECT t.id, t.description, t.due_date, t.done, a.company, a.position FROM todos t
         LEFT JOIN applications a ON t.application_id = a.id
         WHERE t.user_id = ? AND t.due_date >= ? AND t.due_date <= ? ORDER BY t.due_date`
      : `SELECT t.id, t.description, t.due_date, t.done, a.company, a.position FROM todos t
         LEFT JOIN applications a ON t.application_id = a.id
         WHERE t.user_id = ? ORDER BY t.due_date LIMIT 100`;

    const todoResult = db.exec(
      todoQuery,
      month ? [userId, month + '-01', month + '-31'] : [userId]
    );
    if (todoResult.length > 0) {
      const cols = todoResult[0].columns;
      todoResult[0].values.forEach(v => {
        const obj = {};
        cols.forEach((c, i) => obj[c] = v[i]);
        events.push({
          type: 'todo',
          id: obj.id,
          description: obj.description,
          date: obj.due_date,
          done: obj.done,
          company: obj.company,
          position: obj.position,
        });
      });
    }

    // Timeline events
    if (month) {
      const tlResult = db.exec(
        `SELECT t.id, t.event_date, t.event_type, t.description, a.company, a.position FROM timeline t
         LEFT JOIN applications a ON t.application_id = a.id
         WHERE t.user_id = ? AND t.event_date >= ? AND t.event_date <= ?
         ORDER BY t.event_date`,
        [userId, month + '-01', month + '-31']
      );
      if (tlResult.length > 0) {
        const cols = tlResult[0].columns;
        tlResult[0].values.forEach(v => {
          const obj = {};
          cols.forEach((c, i) => obj[c] = v[i]);
          events.push({
            type: 'timeline',
            id: obj.id,
            date: obj.event_date,
            eventType: obj.event_type,
            description: obj.description,
            company: obj.company,
            position: obj.position,
          });
        });
      }
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
