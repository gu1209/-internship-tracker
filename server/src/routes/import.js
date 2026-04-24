const express = require('express');
const multer = require('multer');
const { getDb, saveDb } = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/import/preview - Preview CSV data
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });

    let text = req.file.buffer.toString('utf8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // Strip BOM
    const rows = parseCSV(text);

    if (rows.length < 2) return res.status(400).json({ error: '文件数据不足' });

    // Auto-detect columns from header
    const header = rows[0].map(h => h.trim().toLowerCase());
    const dataRows = rows.slice(1, 11).map(row => {
      const obj = {};
      header.forEach((h, i) => obj[h] = (row[i] || '').trim());
      return obj;
    });

    res.json({ header, preview: dataRows, total: rows.length - 1 });
  } catch (err) {
    res.status(500).json({ error: '解析失败: ' + err.message });
  }
});

// POST /api/import/confirm - Import confirmed data
router.post('/confirm', async (req, res) => {
  try {
    const db = getDb();
    const { rows, mapping } = req.body;
    const userId = req.user.id;

    if (!rows || !rows.length) return res.status(400).json({ error: '没有数据' });

    let imported = 0;
    let errors = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const company = row[mapping.company];
        const position = row[mapping.position];
        const delivery_date = row[mapping.delivery_date] || new Date().toISOString().split('T')[0];
        const status = row[mapping.status] || '已投递';
        const job_url = row[mapping.job_url] || '';
        const interview_date = row[mapping.interview_date] || '';
        const notes = row[mapping.notes] || '';

        if (!company || !position) {
          errors.push(`第${i + 1}行: 公司或岗位为空`);
          continue;
        }

        db.run(
          `INSERT INTO applications (user_id, company, position, job_url, delivery_date, interview_date, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, company, position, job_url, delivery_date, interview_date, status, notes]
        );

        const idResult = db.exec('SELECT last_insert_rowid()');
        const id = idResult[0].values[0][0];

        db.run(
          `INSERT INTO timeline (user_id, application_id, event_date, event_type, description) VALUES (?, ?, ?, '投递', ?)`,
          [userId, id, delivery_date, `向 ${company} 投递了 ${position}`]
        );

        imported++;
      } catch (e) {
        errors.push(`第${i + 1}行: ${e.message}`);
      }
    }

    saveDb();
    res.json({ imported, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(current); current = ''; }
      else if (ch === '\n' || ch === '\r') {
        row.push(current);
        current = '';
        if (row.some(c => c.trim())) rows.push(row);
        row = [];
        if (ch === '\r' && text[i + 1] === '\n') i++;
      } else {
        current += ch;
      }
    }
  }
  row.push(current);
  if (row.some(c => c.trim())) rows.push(row);
  return rows;
}

module.exports = router;
