
/**
 * Mobile-specific functionality
 */

// Mobile API shim
window.mobileAPI = {
  getSettings: async () => {
    const stored = localStorage.getItem('f7lans-settings');
    return stored ? JSON.parse(stored) : {
      serverUrl: '',
      minimizeToTray: false,
      startMinimized: false,
      voiceActivated: true,
      voiceActivationThreshold: 50,
      inputVolume: 100,
      outputVolume: 100
    };
  },

  saveSettings: async (settings) => {
    localStorage.setItem('f7lans-settings', JSON.stringify(settings));
    return true;
  },

  saveToken: async (token) => {
    localStorage.setItem('f7lans-token', token);
    return true;
  },

  getToken: async () => {
    return localStorage.getItem('f7lans-token');
  },

  clearToken: async () => {
    localStorage.removeItem('f7lans-token');
    return true;
  },

  setServerUrl: async (url) => {
    const settings = await window.mobileAPI.getSettings();
    settings.serverUrl = url;
    await window.mobileAPI.saveSettings(settings);
    return true;
  },

  showNotification: (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  },

  // Screen sharing not available on mobile
  getScreenSources: null
};

// Request notification permission
if ('Notification' in window) {
  Notification.requestPermission();
}

// Initialize Capacitor plugins
document.addEventListener('DOMContentLoaded', async () => {
  if (window.Capacitor) {
    const { StatusBar, SplashScreen, Keyboard } = window.Capacitor.Plugins;

    // Hide splash screen after app loads
    if (SplashScreen) {
      setTimeout(() => SplashScreen.hide(), 1000);
    }

    // Configure keyboard
    if (Keyboard) {
      Keyboard.setAccessoryBarVisible({ isVisible: true });
    }

    // Configure status bar
    if (StatusBar) {
      StatusBar.setBackgroundColor({ color: '#0a0a0f' });
    }
  }
});

// Handle back button on Android
document.addEventListener('backbutton', (e) => {
  // If modal is open, close it
  const modal = document.getElementById('modalOverlay');
  if (modal && modal.classList.contains('active')) {
    e.preventDefault();
    closeModal();
    return;
  }

  // Otherwise, let default behavior handle it
}, false);

console.log('F7Lans Mobile initialized');
