const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

// Google OAuth configuration from environment variables
// Supports both naming conventions for backwards compatibility
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.OAUTH_GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback';

// Check if Google OAuth is configured
const isGoogleAuthEnabled = () => {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
};

// Get Google OAuth status (for client to know if button should be shown)
const getGoogleAuthStatus = (req, res) => {
  res.json({
    enabled: isGoogleAuthEnabled(),
    clientId: GOOGLE_CLIENT_ID || null
  });
};

// Generate Google OAuth URL for client redirect
const getGoogleAuthUrl = (req, res) => {
  if (!isGoogleAuthEnabled()) {
    return res.status(503).json({ error: 'Google authentication is not configured' });
  }

  const baseUrl = req.query.baseUrl || `${req.protocol}://${req.get('host')}`;
  const callbackUrl = `${baseUrl}${GOOGLE_CALLBACK_URL}`;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  res.json({ url: authUrl, callbackUrl });
};

// Handle Google OAuth callback
const handleGoogleCallback = async (req, res) => {
  try {
    if (!isGoogleAuthEnabled()) {
      return res.status(503).json({ error: 'Google authentication is not configured' });
    }

    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const baseUrl = req.query.baseUrl || `${req.protocol}://${req.get('host')}`;
    const callbackUrl = `${baseUrl}${GOOGLE_CALLBACK_URL}`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Google token error:', tokenData);
      return res.status(400).json({ error: 'Failed to exchange authorization code' });
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const googleUser = await userInfoResponse.json();

    if (!googleUser.email) {
      return res.status(400).json({ error: 'Failed to get user email from Google' });
    }

    // Find or create user
    let user = await User.findOne({
      $or: [
        { googleId: googleUser.id },
        { email: googleUser.email.toLowerCase() }
      ]
    });

    if (user) {
      // Existing user - link Google account if not already linked
      if (!user.googleId) {
        user.googleId = googleUser.id;
      }
      // Update avatar if user doesn't have one
      if (!user.avatar && googleUser.picture) {
        user.avatar = googleUser.picture;
      }
    } else {
      // Create new user
      // Generate unique username from email
      let baseUsername = googleUser.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      if (baseUsername.length < 3) {
        baseUsername = baseUsername + 'user';
      }
      if (baseUsername.length > 32) {
        baseUsername = baseUsername.substring(0, 32);
      }

      let username = baseUsername;
      let counter = 1;

      // Ensure unique username
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      user = new User({
        username,
        displayName: googleUser.name || username,
        email: googleUser.email.toLowerCase(),
        googleId: googleUser.id,
        avatar: googleUser.picture || null
      });
    }

    // Update status and save
    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Return HTML that sends message to opener window (for popup flow)
    // or redirect with token (for redirect flow)
    const isPopup = req.query.popup === 'true';

    if (isPopup) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Successful</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'google-auth-success',
                token: '${token}',
                user: ${JSON.stringify(user.toPublicProfile())}
              }, '*');
              window.close();
            } else {
              document.body.innerHTML = '<p>Authentication successful. You can close this window.</p>';
            }
          </script>
          <p>Authentication successful. This window should close automatically...</p>
        </body>
        </html>
      `);
    } else {
      // Redirect to client with token in URL fragment (for Electron)
      const clientUrl = process.env.CLIENT_URL || baseUrl;
      res.redirect(`${clientUrl}?googleAuth=success&token=${token}`);
    }

  } catch (error) {
    console.error('Google auth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Link Google account to existing user
const linkGoogleAccount = async (req, res) => {
  try {
    if (!isGoogleAuthEnabled()) {
      return res.status(503).json({ error: 'Google authentication is not configured' });
    }

    const { code, baseUrl } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const callbackUrl = `${baseUrl || `${req.protocol}://${req.get('host')}`}${GOOGLE_CALLBACK_URL}`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({ error: 'Failed to exchange authorization code' });
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const googleUser = await userInfoResponse.json();

    // Check if this Google account is already linked to another user
    const existingGoogleUser = await User.findOne({ googleId: googleUser.id });
    if (existingGoogleUser && existingGoogleUser._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ error: 'This Google account is already linked to another user' });
    }

    // Link Google account to current user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { googleId: googleUser.id },
      { new: true }
    );

    res.json({
      message: 'Google account linked successfully',
      user: user.toPublicProfile()
    });

  } catch (error) {
    console.error('Link Google account error:', error);
    res.status(500).json({ error: 'Failed to link Google account' });
  }
};

// Unlink Google account from user
const unlinkGoogleAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.googleId) {
      return res.status(400).json({ error: 'No Google account linked' });
    }

    // Ensure user has a password set before unlinking (so they can still log in)
    if (!user.password) {
      return res.status(400).json({
        error: 'Please set a password before unlinking your Google account'
      });
    }

    user.googleId = null;
    await user.save();

    res.json({
      message: 'Google account unlinked successfully',
      user: user.toPublicProfile()
    });

  } catch (error) {
    console.error('Unlink Google account error:', error);
    res.status(500).json({ error: 'Failed to unlink Google account' });
  }
};

module.exports = {
  isGoogleAuthEnabled,
  getGoogleAuthStatus,
  getGoogleAuthUrl,
  handleGoogleCallback,
  linkGoogleAccount,
  unlinkGoogleAccount
};
