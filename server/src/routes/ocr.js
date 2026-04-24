const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const { getDb, saveDb } = require('../db');

const router = express.Router();

// In-memory storage for uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/ocr/recognize - Upload image and get parsed data
router.post('/recognize', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片' });
    }

    // Compress image for faster OCR
    const processedBuffer = await sharp(req.file.buffer)
      .resize(1600, null, { fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .toFormat('png')
      .toBuffer();

    // Run Tesseract OCR (Chinese + English)
    const { data: { text } } = await Tesseract.recognize(processedBuffer, 'chi_sim+eng', {
      logger: () => {},
    });

    // Parse OCR text to extract structured data
    const parsed = parseOcrText(text);
    res.json({ text, parsed });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: 'OCR识别失败: ' + err.message });
  }
});

// POST /api/ocr/confirm - Confirm parsed data and create application
router.post('/confirm', async (req, res) => {
  try {
    const db = getDb();
    const { company, position, job_url, delivery_date, interview_date, notes } = req.body;
    const userId = req.user.id;

    if (!company || !position || !delivery_date) {
      return res.status(400).json({ error: '公司、岗位、投递日期不能为空' });
    }

    db.run(
      `INSERT INTO applications (user_id, company, position, job_url, delivery_date, interview_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, '已投递', ?)`,
      [userId, company, position, job_url || '', delivery_date, interview_date || '', notes || '']
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

function parseOcrText(text) {
  const result = {
    company: '',
    position: '',
    delivery_date: '',
    interview_date: '',
    notes: '',
    confidence: 'low',
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Extract dates (various Chinese formats)
  const datePatterns = [
    /(\d{4})[年\/.-](\d{1,2})[月\/.-](\d{1,2})[日号]?/,
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    /(\d{2})[\/.](\d{1,2})[\/.](\d{1,2})/,
    /(\d{1,2})[月](\d{1,2})[日号]?/,
  ];

  let foundDates = [];
  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        let dateStr;
        if (match[0].includes('月')) {
          const year = new Date().getFullYear();
          dateStr = `${year}-${match[1].padStart(2, '0')}-${(match[2] || '01').padStart(2, '0')}`;
        } else {
          dateStr = `${match[1].length === 2 ? '20' + match[1] : match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
        foundDates.push({ date: dateStr, line });
      }
    }
  }

  // First date is likely delivery date, second is interview date
  if (foundDates.length > 0) {
    result.delivery_date = foundDates[0].date;
  }
  if (foundDates.length > 1) {
    // Check if second date is in context of "面试"
    const interviewDate = foundDates.find(d => d.line.includes('面试') || d.line.includes('笔试'));
    if (interviewDate) {
      result.interview_date = interviewDate.date;
    }
  }

  // Extract company name - look for known patterns
  const companyKeywords = [
    /(?:公司|企业|单位)[：:]\s*(.+)/,
    /(.+?)(?:公司|集团|科技|网络|软件|技术|信息)/,
    /(?:投递|应聘|申请)[至到]?\s*(.+)/,
  ];

  const knownCompanies = [
    '字节', '阿里', '腾讯', '百度', '美团', '京东', '拼多多', '网易',
    '小米', '华为', 'OPPO', 'vivo', '滴滴', '快手', '小红书', '携程',
    '贝壳', '蚂蚁', '商汤', '旷视', '依图', '思必驰', '云从',
    '微软', '谷歌', '亚马逊', '苹果', 'Meta', '亚马逊',
    'Shopee', 'Lazada', 'Grab', 'Sea',
  ];

  for (const line of lines) {
    for (const kw of knownCompanies) {
      if (line.includes(kw)) {
        result.company = extractCompanyName(line, kw);
        break;
      }
    }
    if (result.company) break;
  }

  if (!result.company) {
    for (const pattern of companyKeywords) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
          result.company = match[1].trim().replace(/[，,。；;：:]/g, '').substring(0, 30);
          break;
        }
      }
      if (result.company) break;
    }
  }

  // Extract position
  const positionPatterns = [
    /(?:岗位|职位|职务)[：:]\s*(.+)/,
    /(?:应聘|申请|投递)[了的]?\s*(.+?)(?:实习|岗位|职位|工程师|开发|产品|设计|运营)/,
    /(.+?(?:实习|工程师|开发|产品|设计|运营|分析师|管培生))/,
  ];

  const positionKeywords = [
    '前端', '后端', '全栈', 'Java', 'Python', 'Go', 'C++', '算法',
    '数据', '产品', '运营', '设计', '测试', '运维', '安全',
    '管培生', '分析师', '实习生', '工程师',
  ];

  for (const line of lines) {
    for (const kw of positionKeywords) {
      if (line.includes(kw) && line.length < 50) {
        result.position = line.replace(/[，,。；;：:【】\[\]]/g, '').trim().substring(0, 40);
        break;
      }
    }
    if (result.position) break;
  }

  if (!result.position) {
    for (const pattern of positionPatterns) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
          result.position = match[1].trim().replace(/[，,。；;：:]/g, '').substring(0, 40);
          break;
        }
      }
      if (result.position) break;
    }
  }

  // Determine confidence
  if (result.company && result.position) {
    result.confidence = 'high';
  } else if (result.company || result.position) {
    result.confidence = 'medium';
  }

  // Combine remaining lines as notes
  result.notes = lines.slice(0, 5).join(' | ').substring(0, 500);

  return result;
}

function extractCompanyName(line, keyword) {
  // Try to get the full company name around the keyword
  const idx = line.indexOf(keyword);
  // Expand left and right to get full name
  let start = Math.max(0, idx - 5);
  let end = Math.min(line.length, idx + keyword.length + 10);
  let name = line.substring(start, end);
  // Clean up
  name = name.replace(/^[，,。；;：:【】\[\]\s]+/, '').replace(/[，,。；;：:【】\[\]\s]+$/, '');
  // Try to find "公司" or "集团" suffix
  const suffixMatch = name.match(/(.+?(?:公司|集团|科技|网络|技术|信息))/);
  if (suffixMatch) return suffixMatch[1];
  return name.substring(0, 30);
}

module.exports = router;
