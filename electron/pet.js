const pet = document.getElementById('pet');
const messageEl = document.getElementById('message');

let currentState = 'idle';
let messageTimeout = null;
let walkInterval = null;

// Pet messages for different actions
const messages = {
  login: ['欢迎回来！加油！', '今天也要努力哦！', '开始战斗吧！'],
  add: ['投递成功！冲！', '已记录！好运！', '又投了一家！'],
  update: ['进展不错！', '好消息！', '继续前进！'],
  delete: ['已删除~', '没事，下一个更好！'],
  error: ['呜呜，出错了...', '好像有问题...'],
  reject: ['别灰心！再接再厉！', '下一个更好！'],
  idle: ['摸摸头~', '要休息一下吗？', '今天投了几家了？', '加油加油！'],
};

function randomMsg(key) {
  const arr = messages[key] || messages.idle;
  return arr[Math.floor(Math.random() * arr.length)];
}

// Show message bubble
function showMessage(text, duration = 3000) {
  messageEl.textContent = text;
  messageEl.classList.remove('hidden');

  if (messageTimeout) clearTimeout(messageTimeout);
  messageTimeout = setTimeout(() => {
    messageEl.classList.add('hidden');
  }, duration);
}

// Set pet state
function setState(state) {
  pet.classList.remove('idle', 'walking', 'jumping', 'sad');
  pet.classList.add(state);
  currentState = state;

  // Auto-return to idle after animation
  if (state === 'jumping') {
    setTimeout(() => setState('idle'), 1000);
  }
  if (state === 'sad') {
    setTimeout(() => setState('idle'), 3000);
  }
}

// Walking behavior: pet slowly moves around
function startWalking() {
  if (walkInterval) clearInterval(walkInterval);

  let direction = Math.random() > 0.5 ? 1 : -1;
  walkInterval = setInterval(() => {
    if (currentState !== 'idle' && currentState !== 'walking') return;

    setState('walking');

    // Random direction changes
    if (Math.random() < 0.3) {
      direction *= -1;
    }

    // Stop walking after a bit
    setTimeout(() => {
      if (currentState === 'walking') {
        setState('idle');
      }
    }, 3000 + Math.random() * 3000);

  }, 8000 + Math.random() * 7000);
}

// === DRAG SUPPORT ===
let isDragging = false;
let dragStartX, dragStartY;
let dragMoved = false;

pet.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragMoved = false;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  pet.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.screenX - dragStartX;
  const dy = e.screenY - dragStartY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    dragMoved = true;
    window.electronAPI.dragWindow(dx, dy);
    dragStartX = e.screenX;
    dragStartY = e.screenY;
  }
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    pet.style.cursor = 'grab';
  }
});

// Click to open panel (only if not dragged)
pet.addEventListener('click', (e) => {
  if (dragMoved || e.target.closest('.message-bubble')) return;
  window.electronAPI.openPanel();
});

// Listen for actions from panel
window.electronAPI.onPetAction((action) => {
  switch (action) {
    case 'jump':
      setState('jumping');
      showMessage(randomMsg('add'));
      break;
    case 'sad':
      setState('sad');
      showMessage(randomMsg('reject'));
      break;
    case 'update':
      setState('jumping');
      showMessage(randomMsg('update'));
      break;
    case 'login':
      setState('jumping');
      showMessage(randomMsg('login'));
      break;
    case 'error':
      setState('sad');
      showMessage(randomMsg('error'));
      break;
  }
});

// Panel closed - return to idle
window.electronAPI.onPanelClosed(() => {
  setState('idle');
});

// Init
setState('idle');
showMessage('你好呀！点我开始~', 4000);
startWalking();

// Occasional idle messages
setInterval(() => {
  if (currentState === 'idle' && messageEl.classList.contains('hidden')) {
    if (Math.random() < 0.3) {
      showMessage(randomMsg('idle'), 2500);
    }
  }
}, 15000);
