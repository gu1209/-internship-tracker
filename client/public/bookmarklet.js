// Bookmarklet: drag this to your bookmarks bar
// When on a job posting page, click the bookmark to auto-import to Internship Tracker

(function() {
  const API_BASE = 'http://121.41.118.22:3001/api';

  // Try to extract job info from current page
  const url = window.location.href;
  const title = document.title;
  let company = '';
  let position = '';

  // BOSS直聘
  if (url.includes('zhipin.com')) {
    const companyEl = document.querySelector('.company-name, [class*="company"]');
    const positionEl = document.querySelector('.job-name, .position-name, h1');
    company = companyEl?.textContent?.trim() || '';
    position = positionEl?.textContent?.trim() || '';
  }
  // 拉勾
  else if (url.includes('lagou.com')) {
    const companyEl = document.querySelector('[class*="company"], .c_feature');
    const positionEl = document.querySelector('h1, [class*="position"]');
    company = companyEl?.textContent?.trim() || '';
    position = positionEl?.textContent?.trim() || '';
  }
  // 猎聘
  else if (url.includes('liepin.com')) {
    const companyEl = document.querySelector('[class*="company"], .comp-name');
    const positionEl = document.querySelector('h1, [class*="title"]');
    company = companyEl?.textContent?.trim() || '';
    position = positionEl?.textContent?.trim() || '';
  }
  // 前程无忧
  else if (url.includes('51job.com')) {
    const companyEl = document.querySelector('.catn, [class*="company"]');
    const positionEl = document.querySelector('h1, .job_name');
    company = companyEl?.textContent?.trim() || '';
    position = positionEl?.textContent?.trim() || '';
  }
  // 智联招聘
  else if (url.includes('zhaopin.com')) {
    const companyEl = document.querySelector('[class*="company"], .company-name');
    const positionEl = document.querySelector('h1, [class*="title"]');
    company = companyEl?.textContent?.trim() || '';
    position = positionEl?.textContent?.trim() || '';
  }

  // Fallback: try to parse from title
  if (!company && !position) {
    const parts = title.split(/[-–—|]/);
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed.match(/实习|岗位|工程师|开发|产品|设计|运营/) && trimmed.length < 60) {
        position = trimmed;
      } else if (trimmed.match(/[一-龥]{2,}/) && !trimmed.match(/招聘|网|职位/) && trimmed.length < 30) {
        company = trimmed;
      }
    }
  }

  // Build and open import dialog
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;';

  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:12px;padding:24px;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

  card.innerHTML = `
    <h3 style="margin:0 0 16px;font-size:18px;">📮 导入到实习投递管理</h3>
    <div style="margin-bottom:12px;">
      <label style="font-size:12px;color:#888;">公司</label>
      <input id="it-company" value="${company}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;" />
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:12px;color:#888;">岗位</label>
      <input id="it-position" value="${position}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;" />
    </div>
    <div style="font-size:12px;color:#888;margin-bottom:16px;">链接: ${url.substring(0, 60)}...</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button id="it-cancel" style="padding:8px 16px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;">取消</button>
      <button id="it-submit" style="padding:8px 16px;border:none;border-radius:6px;background:#1890ff;color:#fff;cursor:pointer;font-weight:bold;">导入</button>
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  document.getElementById('it-cancel').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  document.getElementById('it-submit').onclick = async () => {
    const c = document.getElementById('it-company').value.trim();
    const p = document.getElementById('it-position').value.trim();
    if (!c || !p) {
      alert('请填写公司和岗位');
      return;
    }

    const token = prompt('请输入你的登录 Token（在系统中点击右上角可查看）');
    if (!token) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(API_BASE + '/parse-url/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          company: c,
          position: p,
          job_url: url,
          delivery_date: today,
        }),
      });

      if (res.ok) {
        alert('✅ 导入成功！');
        overlay.remove();
      } else {
        const err = await res.json();
        alert('导入失败: ' + (err.error || '未知错误'));
      }
    } catch (e) {
      alert('网络错误: ' + e.message);
    }
  };
})();
