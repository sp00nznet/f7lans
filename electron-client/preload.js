const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

// Expose secure APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Authentication
  saveToken: (token) => ipcRenderer.invoke('save-token', token),
  getToken: () => ipcRenderer.invoke('get-token'),
  clearToken: () => ipcRenderer.invoke('clear-token'),

  // Server
  setServerUrl: (url) => ipcRenderer.invoke('set-server-url', url),

  // Notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
  flashWindow: () => ipcRenderer.send('flash-window'),

  // Tray
  updateTrayStatus: (status) => ipcRenderer.send('update-tray-status', status),

  // Event listeners
  onToggleMute: (callback) => ipcRenderer.on('toggle-mute', callback),
  onToggleDeafen: (callback) => ipcRenderer.on('toggle-deafen', callback),
  onPTTStart: (callback) => ipcRenderer.on('ptt-start', callback),
  onPTTEnd: (callback) => ipcRenderer.on('ptt-end', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),

  // Screen sharing - get available sources
  getScreenSources: async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
      display_id: source.display_id
    }));
  },

  // Platform info
  platform: process.platform,
  version: process.versions.electron
});
