// === STATE ===
let token = null;
let serverUrl = 'http://localhost:3001';
let username = '';
let recentApps = [];

const STATUS_FLOW = ['已投递', '笔试', '一面', '二面', 'HR面', 'offer', '拒信', '放弃'];
const STATUS_COLORS = {
  '已投递': '#60A5FA', '笔试': '#34D399', '一面': '#10B981', '二面': '#3B82F6',
  'HR面': '#F59E0B', 'offer': '#F59E0B', '拒信': '#EF4444', '放弃': '#9CA3AF',
};

// === API HELPER ===
async function apiFetch(path, options = {}) {
  const url = `${serverUrl}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    logout();
    throw new Error('登录已过期');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

// === TAB SWITCHING ===
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const tabName = tab.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

    if (!token) {
      document.getElementById('login-view').classList.remove('hidden');
      return;
    }

    const viewMap = { add: 'add-view', status: 'status-view', overview: 'overview-view' };
    document.getElementById(viewMap[tabName]).classList.remove('hidden');

    if (tabName === 'status') loadRecentApps();
    if (tabName === 'overview') loadOverview();
  });
});

// === LOGIN ===
document.getElementById('login-btn').addEventListener('click', async () => {
  const url = document.getElementById('server-url').value.trim() || 'http://localhost:3001';
  const uname = document.getElementById('username').value.trim();
  const pwd = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');

  if (!uname || !pwd) {
    errorEl.textContent = '请输入用户名和密码';
    return;
  }

  serverUrl = url;
  window.electronAPI.setServerUrl(url);

  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: uname, password: pwd }),
    });
    token = data.token;
    username = data.user?.username || uname;
    window.electronAPI.setToken(token);
    showLoggedIn();
    window.electronAPI.sendAction('login');
    errorEl.textContent = '';
  } catch (e) {
    errorEl.textContent = e.message || '登录失败';
  }
});

// === LOGOUT ===
document.getElementById('logout-btn').addEventListener('click', logout);

function logout() {
  token = null;
  username = '';
  window.electronAPI.setToken('');
  showLoggedOut();
}

function showLoggedIn() {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('add-view').classList.remove('hidden');
  document.getElementById('logout-btn').classList.remove('hidden');
  document.getElementById('user-info').textContent = `👤 ${username}`;
  document.getElementById('user-info').classList.remove('hidden');

  // Reset tabs to show add tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.tab[data-tab="add"]').classList.add('active');
}

function showLoggedOut() {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('logout-btn').classList.add('hidden');
  document.getElementById('user-info').classList.add('hidden');
}

// === QUICK ADD ===
document.getElementById('add-btn').addEventListener('click', async () => {
  const company = document.getElementById('add-company').value.trim();
  const position = document.getElementById('add-position').value.trim();
  const resultEl = document.getElementById('add-result');

  if (!company || !position) {
    resultEl.textContent = '请填写公司和岗位';
    resultEl.className = 'result-msg error';
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  try {
    await apiFetch('/api/applications', {
      method: 'POST',
      body: JSON.stringify({ company, position, delivery_date: today }),
    });
    resultEl.textContent = `✅ ${company} - ${position} 投递成功！`;
    resultEl.className = 'result-msg success';
    document.getElementById('add-company').value = '';
    document.getElementById('add-position').value = '';
    window.electronAPI.sendAction('jump');
  } catch (e) {
    resultEl.textContent = `❌ ${e.message}`;
    resultEl.className = 'result-msg error';
    window.electronAPI.sendAction('error');
  }
});

// === STATUS CHANGE ===
async function loadRecentApps() {
  try {
    const data = await apiFetch('/api/applications?page=1&pageSize=15');
    recentApps = data.data || [];
    const select = document.getElementById('status-select');
    select.innerHTML = '<option value="">-- 选择投递记录 --</option>';
    recentApps.forEach(app => {
      const opt = document.createElement('option');
      opt.value = app.id;
      opt.textContent = `${app.company} - ${app.position}（${app.status}）`;
      opt.dataset.status = app.status;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error('Failed to load apps:', e);
  }
}

// Update status dropdown based on selected app
document.getElementById('status-select').addEventListener('change', () => {
  const selected = document.getElementById('status-select').selectedOptions[0];
  const currentStatus = selected.dataset.status;
  const statusSelect = document.getElementById('new-status');
  const currentIdx = STATUS_FLOW.indexOf(currentStatus);

  // Show only forward statuses
  statusSelect.innerHTML = '';
  const nextStatuses = STATUS_FLOW.slice(currentIdx + 1);
  if (nextStatuses.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = '已是最终状态';
    opt.value = '';
    statusSelect.appendChild(opt);
  } else {
    nextStatuses.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s === 'offer' ? 'Offer 🎉' : s;
      statusSelect.appendChild(opt);
    });
  }
});

document.getElementById('status-btn').addEventListener('click', async () => {
  const appId = document.getElementById('status-select').value;
  const newStatus = document.getElementById('new-status').value;
  const resultEl = document.getElementById('status-result');

  if (!appId || !newStatus) {
    resultEl.textContent = '请选择记录和状态';
    resultEl.className = 'result-msg error';
    return;
  }

  try {
    await apiFetch(`/api/applications/${appId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    const app = recentApps.find(a => a.id === parseInt(appId));
    resultEl.textContent = `✅ ${app?.company || ''} → ${newStatus}`;
    resultEl.className = 'result-msg success';
    window.electronAPI.sendAction(newStatus === '拒信' ? 'sad' : 'update');
    loadRecentApps(); // Refresh list
  } catch (e) {
    resultEl.textContent = `❌ ${e.message}`;
    resultEl.className = 'result-msg error';
    window.electronAPI.sendAction('error');
  }
});

// === OVERVIEW ===
async function loadOverview() {
  try {
    const overview = await apiFetch('/api/analytics/overview');

    document.getElementById('stat-total').textContent = overview.total || 0;
    document.getElementById('stat-offers').textContent = overview.offers || 0;
    document.getElementById('stat-response').textContent = (overview.responseRate || 0) + '%';
    document.getElementById('stat-conversion').textContent = (overview.conversionRate || 0) + '%';

    // Status distribution
    const distEl = document.getElementById('status-dist');
    distEl.innerHTML = '';
    if (overview.statusDist) {
      Object.entries(overview.statusDist).forEach(([status, count]) => {
        if (count > 0) {
          const tag = document.createElement('span');
          tag.className = 'status-tag';
          tag.style.background = STATUS_COLORS[status] || '#9CA3AF';
          tag.textContent = `${status} ${count}`;
          distEl.appendChild(tag);
        }
      });
    }

    // Stale reminder
    const staleEl = document.getElementById('stale-reminder');
    try {
      const staleData = await apiFetch('/api/analytics/stale?days=7');
      if (staleData && staleData.length > 0) {
        staleEl.textContent = `⚠️ ${staleData.length} 条投递超过7天无进展`;
        staleEl.classList.remove('hidden');
        window.electronAPI.sendAction('sad');
      } else {
        staleEl.classList.add('hidden');
      }
    } catch (e) {
      staleEl.classList.add('hidden');
    }
  } catch (e) {
    console.error('Failed to load overview:', e);
  }
}

document.getElementById('refresh-overview').addEventListener('click', loadOverview);

// === INIT: Check saved token ===
(async function init() {
  const savedToken = await window.electronAPI.getToken();
  const savedUrl = await window.electronAPI.getServerUrl();

  if (savedUrl) {
    serverUrl = savedUrl;
    document.getElementById('server-url').value = savedUrl;
  }

  if (savedToken) {
    token = savedToken;
    // Verify token is still valid
    try {
      const me = await apiFetch('/api/auth/me');
      username = me.username || '';
      showLoggedIn();
    } catch (e) {
      // Token expired
      logout();
    }
  }
})();
