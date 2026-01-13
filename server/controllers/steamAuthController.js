// Steam Authentication Controller
// Uses Steam OpenID for verification

const User = require('../models/User');
const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

// Store pending authentications
const pendingAuths = new Map();

// Steam OpenID endpoints
const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
const STEAM_API_URL = 'https://api.steampowered.com';

// Get the Steam auth URL for the user
const getAuthUrl = async (req, res) => {
  try {
    // Generate a unique state token
    const state = crypto.randomBytes(16).toString('hex');
    const returnUrl = req.body.returnUrl || `${req.protocol}://${req.get('host')}/api/steam/callback`;

    // Store pending auth
    pendingAuths.set(state, {
      userId: req.user._id.toString(),
      createdAt: Date.now(),
      returnUrl
    });

    // Clean up old pending auths
    for (const [key, value] of pendingAuths) {
      if (Date.now() - value.createdAt > 10 * 60 * 1000) {
        pendingAuths.delete(key);
      }
    }

    // Build Steam OpenID URL
    const params = {
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': `${returnUrl}?state=${state}`,
      'openid.realm': `${req.protocol}://${req.get('host')}`,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
    };

    const authUrl = `${STEAM_OPENID_URL}?${querystring.stringify(params)}`;

    res.json({
      authUrl,
      state,
      message: 'Redirect user to this URL to authenticate with Steam'
    });
  } catch (error) {
    console.error('Get Steam auth URL error:', error);
    res.status(500).json({ error: 'Failed to generate Steam auth URL' });
  }
};

// Handle Steam callback
const handleCallback = async (req, res) => {
  try {
    const { state } = req.query;

    // Validate state
    const pendingAuth = pendingAuths.get(state);
    if (!pendingAuth) {
      return res.status(400).json({ error: 'Invalid or expired state token' });
    }

    // Verify the OpenID response
    const isValid = await verifyOpenIdResponse(req.query);
    if (!isValid) {
      pendingAuths.delete(state);
      return res.status(400).json({ error: 'Steam verification failed' });
    }

    // Extract Steam ID from claimed_id
    // Format: https://steamcommunity.com/openid/id/76561198xxxxxxxx
    const claimedId = req.query['openid.claimed_id'];
    const steamIdMatch = claimedId.match(/\/id\/(\d+)$/);

    if (!steamIdMatch) {
      pendingAuths.delete(state);
      return res.status(400).json({ error: 'Could not extract Steam ID' });
    }

    const steamId = steamIdMatch[1];

    // Update user with verified Steam ID
    await User.findByIdAndUpdate(pendingAuth.userId, {
      steamId,
      steamVerified: true
    });

    pendingAuths.delete(state);

    // Redirect or return success
    // In production, this would redirect to the app with a success message
    res.json({
      success: true,
      steamId,
      message: 'Steam account verified successfully'
    });
  } catch (error) {
    console.error('Steam callback error:', error);
    res.status(500).json({ error: 'Failed to verify Steam account' });
  }
};

// Verify OpenID response with Steam
async function verifyOpenIdResponse(params) {
  return new Promise((resolve) => {
    // Build verification request
    const verifyParams = {
      ...params,
      'openid.mode': 'check_authentication'
    };

    const postData = querystring.stringify(verifyParams);

    const options = {
      hostname: 'steamcommunity.com',
      port: 443,
      path: '/openid/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        // Steam returns "is_valid:true" if valid
        resolve(data.includes('is_valid:true'));
      });
    });

    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
}

// Link Steam manually (for when OAuth isn't available)
const linkSteamManual = async (req, res) => {
  try {
    const { steamId } = req.body;

    if (!steamId) {
      return res.status(400).json({ error: 'Steam ID is required' });
    }

    // Validate Steam ID format (64-bit Steam ID)
    if (!/^\d{17}$/.test(steamId)) {
      return res.status(400).json({ error: 'Invalid Steam ID format. Use your 64-bit Steam ID.' });
    }

    // Update user with unverified Steam ID
    await User.findByIdAndUpdate(req.user._id, {
      steamId,
      steamVerified: false
    });

    res.json({
      message: 'Steam ID linked (unverified). Use Steam sign-in to verify.',
      steamId,
      verified: false
    });
  } catch (error) {
    console.error('Link Steam manual error:', error);
    res.status(500).json({ error: 'Failed to link Steam account' });
  }
};

// Get Steam profile info (if we have an API key)
const getSteamProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('steamId steamVerified').lean();

    if (!user.steamId) {
      return res.status(404).json({ error: 'No Steam account linked' });
    }

    res.json({
      steamId: user.steamId,
      verified: user.steamVerified,
      profileUrl: `https://steamcommunity.com/profiles/${user.steamId}`
    });
  } catch (error) {
    console.error('Get Steam profile error:', error);
    res.status(500).json({ error: 'Failed to get Steam profile' });
  }
};

// Unlink Steam account
const unlinkSteam = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      steamId: null,
      steamVerified: false
    });

    res.json({
      message: 'Steam account unlinked successfully'
    });
  } catch (error) {
    console.error('Unlink Steam error:', error);
    res.status(500).json({ error: 'Failed to unlink Steam account' });
  }
};

module.exports = {
  getAuthUrl,
  handleCallback,
  linkSteamManual,
  getSteamProfile,
  unlinkSteam
};
