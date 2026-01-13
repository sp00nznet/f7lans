/**
 * Copy web client files for mobile build
 * This creates a mobile-optimized version of the web client
 */

const fs = require('fs-extra');
const path = require('path');

const electronRenderer = path.join(__dirname, '..', '..', 'electron-client', 'renderer');
const wwwDest = path.join(__dirname, '..', 'www');

async function copyClient() {
  console.log('Copying web client for mobile build...');

  try {
    // Ensure www directory exists
    await fs.ensureDir(wwwDest);

    // Copy renderer files
    const indexHtml = await fs.readFile(path.join(electronRenderer, 'index.html'), 'utf8');
    const appJs = await fs.readFile(path.join(electronRenderer, 'app.js'), 'utf8');

    // Modify HTML for mobile
    let mobileHtml = indexHtml
      .replace('</head>', `
    <!-- Mobile Meta Tags -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="theme-color" content="#0a0a0f">
    <!-- Capacitor -->
    <script src="capacitor.js"></script>
    </head>`)
      .replace('<script src="app.js"></script>', '<script src="app.js"></script>\n    <script src="mobile.js"></script>');

    // Modify app.js to remove Electron-specific code
    let mobileAppJs = appJs
      .replace(/window\.electronAPI/g, 'window.mobileAPI')
      .replace(/if \(window\.electronAPI\)/g, 'if (window.mobileAPI)');

    // Write files
    await fs.writeFile(path.join(wwwDest, 'index.html'), mobileHtml);
    await fs.writeFile(path.join(wwwDest, 'app.js'), mobileAppJs);

    // Create mobile.js with mobile-specific overrides
    const mobileJs = `
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
`;

    await fs.writeFile(path.join(wwwDest, 'mobile.js'), mobileJs);

    console.log('Mobile client files created successfully!');
    console.log(`Destination: ${wwwDest}`);

  } catch (error) {
    console.error('Failed to copy client:', error);
    process.exit(1);
  }
}

copyClient();
