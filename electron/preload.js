const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Panel control
  openPanel: () => ipcRenderer.invoke('open-panel'),
  closePanel: () => ipcRenderer.invoke('close-panel'),

  // Window dragging
  dragWindow: (dx, dy) => ipcRenderer.send('drag-window', dx, dy),

  // Auth token persistence
  getToken: () => ipcRenderer.invoke('get-token'),
  setToken: (token) => ipcRenderer.invoke('set-token', token),

  // Pet animation triggers
  sendAction: (action) => ipcRenderer.send('pet-action', action),

  // Listen for events from main process
  onPanelClosed: (callback) => {
    ipcRenderer.on('panel-closed', callback);
  },
  onPetAction: (callback) => {
    ipcRenderer.on('pet-action', (_, action) => callback(action));
  },
});
