// Server Settings Controller
// Manages server-wide configuration

const ServerSettings = require('../models/ServerSettings');

// Common language codes for reference
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'el', name: 'Greek' }
];

// Get all server settings
const getSettings = async (req, res) => {
  try {
    const settings = await ServerSettings.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Get server settings error:', error);
    res.status(500).json({ error: 'Failed to get server settings' });
  }
};

// Get public settings (non-admin)
const getPublicSettings = async (req, res) => {
  try {
    const settings = await ServerSettings.getSettings();

    // Return only public-facing settings
    res.json({
      serverName: settings.serverName,
      serverDescription: settings.serverDescription,
      defaultTheme: settings.defaultTheme,
      registration: {
        enabled: settings.registration.enabled,
        requireInvite: settings.registration.requireInvite
      }
    });
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
};

// Update server settings
const updateSettings = async (req, res) => {
  try {
    const updates = req.body;

    // Validate updates
    if (updates.videoSettings) {
      const { defaultAudioLanguage, defaultSubtitleLanguage } = updates.videoSettings;

      if (defaultAudioLanguage && !isValidLanguageCode(defaultAudioLanguage)) {
        return res.status(400).json({ error: 'Invalid audio language code' });
      }

      if (defaultSubtitleLanguage && !isValidLanguageCode(defaultSubtitleLanguage)) {
        return res.status(400).json({ error: 'Invalid subtitle language code' });
      }
    }

    const settings = await ServerSettings.updateSettings(updates);

    res.json({
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Update server settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

// Get video settings
const getVideoSettings = async (req, res) => {
  try {
    const settings = await ServerSettings.getSettings();

    res.json({
      ...settings.videoSettings.toObject?.() || settings.videoSettings,
      supportedLanguages: SUPPORTED_LANGUAGES
    });
  } catch (error) {
    console.error('Get video settings error:', error);
    res.status(500).json({ error: 'Failed to get video settings' });
  }
};

// Update video settings
const updateVideoSettings = async (req, res) => {
  try {
    const {
      defaultAudioLanguage,
      defaultSubtitleLanguage,
      subtitlesEnabled,
      defaultQuality
    } = req.body;

    // Validate
    if (defaultAudioLanguage && !isValidLanguageCode(defaultAudioLanguage)) {
      return res.status(400).json({ error: 'Invalid audio language code' });
    }

    if (defaultSubtitleLanguage && !isValidLanguageCode(defaultSubtitleLanguage)) {
      return res.status(400).json({ error: 'Invalid subtitle language code' });
    }

    const validQualities = ['auto', '720p', '1080p', '4k'];
    if (defaultQuality && !validQualities.includes(defaultQuality)) {
      return res.status(400).json({ error: 'Invalid video quality' });
    }

    const updates = {
      videoSettings: {}
    };

    if (defaultAudioLanguage !== undefined) {
      updates.videoSettings.defaultAudioLanguage = defaultAudioLanguage;
    }
    if (defaultSubtitleLanguage !== undefined) {
      updates.videoSettings.defaultSubtitleLanguage = defaultSubtitleLanguage;
    }
    if (subtitlesEnabled !== undefined) {
      updates.videoSettings.subtitlesEnabled = !!subtitlesEnabled;
    }
    if (defaultQuality !== undefined) {
      updates.videoSettings.defaultQuality = defaultQuality;
    }

    const settings = await ServerSettings.updateSettings(updates);

    res.json({
      message: 'Video settings updated',
      videoSettings: settings.videoSettings
    });
  } catch (error) {
    console.error('Update video settings error:', error);
    res.status(500).json({ error: 'Failed to update video settings' });
  }
};

// Get list of supported languages
const getSupportedLanguages = async (req, res) => {
  res.json({ languages: SUPPORTED_LANGUAGES });
};

// Validate language code
function isValidLanguageCode(code) {
  if (!code) return true; // Empty is allowed (means disabled)
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(code) || SUPPORTED_LANGUAGES.some(l => l.code === code);
}

// Get bot enabled status
const getBotStatus = async (req, res) => {
  try {
    const settings = await ServerSettings.getSettings();
    res.json(settings.bots);
  } catch (error) {
    console.error('Get bot status error:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
};

// Update bot enabled status
const updateBotStatus = async (req, res) => {
  try {
    const { bot, enabled } = req.body;

    const validBots = ['youtube', 'plex', 'emby', 'jellyfin', 'iptv', 'spotify', 'chrome', 'activityStats', 'rpg', 'twitch', 'imageSearch', 'starCitizen'];
    if (!validBots.includes(bot)) {
      return res.status(400).json({ error: 'Invalid bot name' });
    }

    const settings = await ServerSettings.getSettings();
    settings.bots[bot] = { enabled: !!enabled };
    await settings.save();

    res.json({
      message: `${bot} bot ${enabled ? 'enabled' : 'disabled'}`,
      bots: settings.bots
    });
  } catch (error) {
    console.error('Update bot status error:', error);
    res.status(500).json({ error: 'Failed to update bot status' });
  }
};

// Upload server icon
const uploadServerIcon = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const iconPath = `/uploads/server/${req.file.filename}`;

    const settings = await ServerSettings.getSettings();
    settings.serverIcon = iconPath;
    await settings.save();

    res.json({
      message: 'Server icon uploaded successfully',
      iconUrl: iconPath
    });
  } catch (error) {
    console.error('Upload server icon error:', error);
    res.status(500).json({ error: 'Failed to upload server icon' });
  }
};

// Delete server icon
const deleteServerIcon = async (req, res) => {
  try {
    const settings = await ServerSettings.getSettings();
    settings.serverIcon = null;
    await settings.save();

    res.json({
      message: 'Server icon removed'
    });
  } catch (error) {
    console.error('Delete server icon error:', error);
    res.status(500).json({ error: 'Failed to delete server icon' });
  }
};

// Get server icon
const getServerIcon = async (req, res) => {
  try {
    const settings = await ServerSettings.getSettings();
    res.json({
      iconUrl: settings.serverIcon
    });
  } catch (error) {
    console.error('Get server icon error:', error);
    res.status(500).json({ error: 'Failed to get server icon' });
  }
};

module.exports = {
  getSettings,
  getPublicSettings,
  updateSettings,
  getVideoSettings,
  updateVideoSettings,
  getSupportedLanguages,
  getBotStatus,
  updateBotStatus,
  uploadServerIcon,
  deleteServerIcon,
  getServerIcon
};
