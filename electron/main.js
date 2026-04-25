const { app, BrowserWindow, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// Simple store using JSON file
const STORE_PATH = path.join(app.getPath('userData'), 'pet-store.json');
const store = {
  get(key, def) {
    try {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      return data[key] ?? def;
    } catch { return def; }
  },
  set(key, val) {
    try {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8') || '{}');
      data[key] = val;
      fs.writeFileSync(STORE_PATH, JSON.stringify(data));
    } catch {
      fs.writeFileSync(STORE_PATH, JSON.stringify({ [key]: val }));
    }
  },
};

let petWin = null;
let panelWin = null;
let tray = null;

const PET_WIDTH = 80;
const PET_HEIGHT = 100;

function createPetWindow() {
  const savedPos = store.get('petPosition');
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  const x = savedPos?.x ?? (screenW - PET_WIDTH - 40);
  const y = savedPos?.y ?? (screenH - PET_HEIGHT - 60);

  petWin = new BrowserWindow({
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  petWin.loadFile(path.join(__dirname, 'pet.html'));
  petWin.setVisibleOnAllWorkspaces(true);

  // Save position on move
  petWin.on('move', () => {
    const [x, y] = petWin.getPosition();
    store.set('petPosition', { x, y });
  });
}

function createPanelWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: screenW } = display.workAreaSize;

  const panelW = 300;
  const panelH = 380;

  // Position panel above the pet
  let [petX, petY] = petWin.getPosition();
  let panelX = petX + PET_WIDTH / 2 - panelW / 2;
  let panelY = petY - panelH - 15;

  // Keep panel on screen
  if (panelX < 0) panelX = 10;
  if (panelX + panelW > screenW) panelX = screenW - panelW - 10;
  if (panelY < 0) panelY = petY + PET_HEIGHT + 10; // show below if no room above

  panelWin = new BrowserWindow({
    width: panelW,
    height: panelH,
    x: panelX,
    y: panelY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  panelWin.loadFile(path.join(__dirname, 'panel.html'));
  panelWin.setVisibleOnAllWorkspaces(true);

  panelWin.on('closed', () => {
    panelWin = null;
    if (petWin) petWin.webContents.send('panel-closed');
  });

  // Close panel when clicking outside
  panelWin.on('blur', () => {
    setTimeout(() => {
      if (panelWin && !panelWin.isFocused()) {
        panelWin.close();
      }
    }, 200);
  });
}

function createTray() {
  // Use a simple icon (we'll create a small icon from the pet)
  const iconPath = path.join(__dirname, '..', 'client', 'public', 'campus-bg.jpg');
  try {
    tray = new Tray(iconPath);
  } catch (e) {
    // Fallback: create a tiny tray icon
    const { nativeImage } = require('electron');
    const img = nativeImage.createEmpty();
    tray = new Tray(img);
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示桌宠', click: () => { if (petWin) petWin.show(); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } },
  ]);

  tray.setToolTip('投递管理桌宠');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (petWin) {
      petWin.show();
      petWin.focus();
    }
  });
}

// Drag support for pet window
ipcMain.on('drag-window', (event, dx, dy) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + dx, y + dy);
});

// IPC handlers
ipcMain.handle('open-panel', () => {
  if (panelWin && !panelWin.isDestroyed()) {
    panelWin.focus();
    return;
  }
  createPanelWindow();
});

ipcMain.handle('close-panel', () => {
  if (panelWin && !panelWin.isDestroyed()) {
    panelWin.close();
  }
});

ipcMain.handle('get-token', () => {
  return store.get('authToken') || null;
});

ipcMain.handle('set-token', (_, token) => {
  store.set('authToken', token);
});

ipcMain.on('pet-action', (_, action) => {
  if (petWin) petWin.webContents.send('pet-action', action);
});

app.whenReady().then(() => {
  createPetWindow();
  createTray();

  app.on('activate', () => {
    if (!petWin) createPetWindow();
  });
});

app.on('window-all-closed', () => {
  // Don't quit on macOS - keep tray
  if (process.platform !== 'darwin') {
    // Only quit if both windows closed and no tray
  }
});

app.on('before-quit', () => {
  if (petWin) petWin.destroy();
  if (panelWin) panelWin.destroy();
});
