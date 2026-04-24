const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const router = express.Router();

// POST /api/parse-url - Parse a job posting URL
router.post('/', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: '请提供URL' });
    }

    const html = await fetchPage(url);
    const parsed = parseJobPage(html, url);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: '解析失败: ' + err.message });
  }
});

// POST /api/parse-url/import - Import parsed data as application
router.post('/import', async (req, res) => {
  try {
    const { getDb, saveDb } = require('../db');
    const db = getDb();
    const { company, position, job_url, delivery_date, interview_date, notes } = req.body;
    const userId = req.user.id;

    if (!company || !position) {
      return res.status(400).json({ error: '公司和岗位不能为空' });
    }

    const today = delivery_date || new Date().toISOString().split('T')[0];

    db.run(
      `INSERT INTO applications (user_id, company, position, job_url, delivery_date, interview_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, '已投递', ?)`,
      [userId, company, position, job_url || '', today, interview_date || '', notes || '']
    );

    const idResult = db.exec('SELECT last_insert_rowid()');
    const id = idResult[0].values[0][0];

    db.run(
      `INSERT INTO timeline (user_id, application_id, event_date, event_type, description) VALUES (?, ?, ?, '投递', ?)`,
      [userId, id, today, `向 ${company} 投递了 ${position}`]
    );

    saveDb();
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

function parseJobPage(html, url) {
  const result = { company: '', position: '', job_url: url, source: '' };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract meta description
  const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const description = metaDesc ? metaDesc[1] : '';

  // Extract og:title
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);

  // Detect source and parse accordingly
  if (url.includes('zhipin.com') || url.includes('boss')) {
    result.source = 'BOSS直聘';
    result.company = parseBossCompany(html, title);
    result.position = parseBossPosition(html, title);
  } else if (url.includes('lagou.com')) {
    result.source = '拉勾网';
    result.company = parseLagouCompany(html, title);
    result.position = parseLagouPosition(html, title);
  } else if (url.includes('liepin.com')) {
    result.source = '猎聘';
    result.company = parseLiepinCompany(html, title);
    result.position = parseLiepinPosition(html, title);
  } else if (url.includes('51job.com') || url.includes('51')) {
    result.source = '前程无忧';
    result.company = parse51Company(html, title);
    result.position = parse51Position(html, title);
  } else if (url.includes('zhaopin.com')) {
    result.source = '智联招聘';
    result.company = parseZhilianCompany(html, title);
    result.position = parseZhilianPosition(html, title);
  } else {
    // Generic fallback
    result.source = '其他';
    result.company = extractGenericCompany(title, description);
    result.position = extractGenericPosition(title, description);
  }

  // Clean up
  result.company = result.company.replace(/[\s_\-]+/g, ' ').trim().substring(0, 50);
  result.position = result.position.replace(/[\s_\-]+/g, ' ').trim().substring(0, 100);

  return result;
}

// BOSS直聘
function parseBossCompany(html, title) {
  // Try structured data first
  const jsonMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[1]);
      if (json.hiringOrganization?.name) return json.hiringOrganization.name;
    } catch (e) {}
  }
  // From title: "岗位名 - 公司名 - BOSS直聘"
  const titleParts = title.split(/[-–—|]/);
  for (const part of titleParts) {
    const p = part.trim();
    if (p && !p.includes('BOSS') && !p.includes('直聘') && !p.includes('招聘') && p.length > 1 && p.length < 30) {
      // Check if it looks like a company name
      if (p.match(/[一-龥]/) && !p.match(/实习|岗位|职位|招聘|工程师|开发|产品/)) {
        return p;
      }
    }
  }
  // From page content
  const companyMatch = html.match(/class="company-name"[^>]*>([^<]+)/);
  if (companyMatch) return companyMatch[1].trim();
  return '';
}

function parseBossPosition(html, title) {
  const jsonMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[1]);
      if (json.title) return json.title;
    } catch (e) {}
  }
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  const titleParts = title.split(/[-–—|]/);
  for (const part of titleParts) {
    const p = part.trim();
    if (p && p.match(/实习|岗位|职位|工程师|开发|产品|设计|运营|分析师/) && p.length < 60) {
      return p;
    }
  }
  return titleParts[0]?.trim() || '';
}

// 拉勾
function parseLagouCompany(html, title) {
  const match = html.match(/class="[^"]*company[^"]*"[^>]*>\s*<[^>]*>([^<]+)/);
  if (match) return match[1].trim();
  const jsonMatch = html.match(/companyName["']\s*:\s*["']([^"']+)/);
  if (jsonMatch) return jsonMatch[1];
  return extractGenericCompany(title, '');
}

function parseLagouPosition(html, title) {
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  const match = html.match(/class="[^"]*position[^"]*"[^>]*>([^<]+)/);
  if (match) return match[1].trim();
  return extractGenericPosition(title, '');
}

// 猎聘
function parseLiepinCompany(html, title) {
  const match = html.match(/compName["']\s*:\s*["']([^"']+)/);
  if (match) return match[1];
  const companyMatch = html.match(/class="[^"]*company[^"]*"[^>]*>([^<]+)/);
  if (companyMatch) return companyMatch[1].trim();
  return extractGenericCompany(title, '');
}

function parseLiepinPosition(html, title) {
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  return extractGenericPosition(title, '');
}

// 前程无忧
function parse51Company(html, title) {
  const match = html.match(/company_name["']\s*:\s*["']([^"']+)/);
  if (match) return match[1];
  const catMatch = html.match(/class="catn"[^>]*>([^<]+)/);
  if (catMatch) return catMatch[1].trim();
  return extractGenericCompany(title, '');
}

function parse51Position(html, title) {
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  const match = html.match(/job_name["']\s*:\s*["']([^"']+)/);
  if (match) return match[1];
  return extractGenericPosition(title, '');
}

// 智联招聘
function parseZhilianCompany(html, title) {
  const match = html.match(/companyName["']\s*:\s*["']([^"']+)/);
  if (match) return match[1];
  return extractGenericCompany(title, '');
}

function parseZhilianPosition(html, title) {
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  return extractGenericPosition(title, '');
}

// Generic fallback
function extractGenericCompany(title, desc) {
  const parts = title.split(/[-–—|_]/);
  for (const part of parts) {
    const p = part.trim();
    if (p && p.match(/[一-龥]{2,}/) && !p.match(/实习|岗位|职位|招聘|工程师|开发|产品|设计|运营/)) {
      return p.substring(0, 50);
    }
  }
  if (desc) {
    const descMatch = desc.match(/(.+?)(?:公司|集团|科技|网络|技术)/);
    if (descMatch) return descMatch[0];
  }
  return '';
}

function extractGenericPosition(title, desc) {
  const parts = title.split(/[-–—|_]/);
  for (const part of parts) {
    const p = part.trim();
    if (p && p.match(/实习|岗位|职位|工程师|开发|产品|设计|运营|分析师/) && p.length < 80) {
      return p;
    }
  }
  return parts[0]?.trim() || '';
}

module.exports = router;
