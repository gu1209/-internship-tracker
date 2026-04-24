const express = require('express');
const { getDb, saveDb } = require('../db');

const router = express.Router();

const STATUS_ORDER = ['已投递', '笔试', '一面', '二面', 'HR面', 'offer', '拒信', '放弃'];

// GET /api/applications?status=&company=&page=&pageSize=
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, company, page = 1, pageSize = 20 } = req.query;
    const userId = req.user.id;

    let where = ['user_id = ?'];
    let params = [userId];

    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (company) {
      where.push('company LIKE ?');
      params.push(`%${company}%`);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const countResult = db.exec(`SELECT COUNT(*) FROM applications ${whereClause}`, params);
    const total = countResult[0]?.values[0]?.[0] || 0;

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const result = db.exec(
      `SELECT * FROM applications ${whereClause} ORDER BY updated_at DESC, delivery_date DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    const columns = result.length > 0 ? result[0].columns : [];
    const rows = result.length > 0 ? result[0].values.map(v => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = v[i]);
      // Compute stale_days
      if (obj.updated_at) {
        obj.stale_days = Math.floor((Date.now() - new Date(obj.updated_at).getTime()) / 86400000);
      }
      return obj;
    }) : [];

    res.json({ total, page: parseInt(page), pageSize: parseInt(pageSize), data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/applications/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec('SELECT * FROM applications WHERE id = ? AND user_id = ?', [parseInt(req.params.id), req.user.id]);
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    const columns = result[0].columns;
    const row = {};
    columns.forEach((col, i) => row[col] = result[0].values[0][i]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/applications
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { company, position, job_url, delivery_date, interview_date, status, notes, resume_version_id, rejection_reason, rejection_stage } = req.body;
    const userId = req.user.id;

    if (!company || !position || !delivery_date) {
      return res.status(400).json({ error: 'company, position, delivery_date are required' });
    }

    db.run(
      `INSERT INTO applications (user_id, company, position, job_url, delivery_date, interview_date, status, notes, resume_version_id, rejection_reason, rejection_stage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, company, position, job_url || '', delivery_date, interview_date || '', status || '已投递', notes || '', resume_version_id || null, rejection_reason || '', rejection_stage || '']
    );

    const idResult = db.exec('SELECT last_insert_rowid()');
    const id = idResult[0].values[0][0];

    db.run(
      `INSERT INTO timeline (user_id, application_id, event_date, event_type, description) VALUES (?, ?, ?, '投递', ?)`,
      [userId, id, delivery_date, `向 ${company} 投递了 ${position}`]
    );

    saveDb();
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/applications/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const userId = req.user.id;
    const existing = db.exec('SELECT * FROM applications WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const columns = existing[0].columns;
    const current = {};
    columns.forEach((col, i) => current[col] = existing[0].values[0][i]);

    const { company, position, job_url, delivery_date, interview_date, status, notes, resume_version_id, rejection_reason, rejection_stage } = req.body;

    db.run(
      `UPDATE applications SET company=?, position=?, job_url=?, delivery_date=?, interview_date=?, status=?, notes=?, resume_version_id=?, rejection_reason=?, rejection_stage=?, updated_at=datetime('now','localtime') WHERE id=? AND user_id=?`,
      [
        company || current.company,
        position || current.position,
        job_url !== undefined ? job_url : current.job_url,
        delivery_date || current.delivery_date,
        interview_date !== undefined ? interview_date : current.interview_date,
        status || current.status,
        notes !== undefined ? notes : current.notes,
        resume_version_id !== undefined ? resume_version_id : current.resume_version_id,
        rejection_reason !== undefined ? rejection_reason : current.rejection_reason,
        rejection_stage !== undefined ? rejection_stage : current.rejection_stage,
        id, userId
      ]
    );

    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/applications/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const userId = req.user.id;
    db.run('DELETE FROM timeline WHERE application_id = ? AND user_id = ?', [id, userId]);
    db.run('DELETE FROM todos WHERE application_id = ? AND user_id = ?', [id, userId]);
    db.run('DELETE FROM applications WHERE id = ? AND user_id = ?', [id, userId]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/applications/:id/status
router.patch('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const userId = req.user.id;
    const { status } = req.body;

    if (!status || !STATUS_ORDER.includes(status)) {
      return res.status(400).json({ error: `无效状态: ${STATUS_ORDER.join(', ')}` });
    }

    const existing = db.exec('SELECT status, company, position FROM applications WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const currentStatus = existing[0].values[0][0];
    const company = existing[0].values[0][1];
    const position = existing[0].values[0][2];
    const currentIdx = STATUS_ORDER.indexOf(currentStatus);
    const newIdx = STATUS_ORDER.indexOf(status);

    if (newIdx <= currentIdx && status !== currentStatus) {
      return res.status(400).json({ error: `不能从 '${currentStatus}' 回退到 '${status}'` });
    }

    if (status === currentStatus) {
      return res.json({ ok: true });
    }

    db.run(
      `UPDATE applications SET status=?, updated_at=datetime('now','localtime') WHERE id=? AND user_id=?`,
      [status, id, userId]
    );

    const today = new Date().toISOString().split('T')[0];
    db.run(
      `INSERT INTO timeline (user_id, application_id, event_date, event_type, description) VALUES (?, ?, ?, ?, ?)`,
      [userId, id, today, status, `${company} ${position} - 状态变更为 ${status}`]
    );

    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
