import User from '../models/User.js';
import WebsiteSetting from '../models/WebsiteSetting.js';
import { verifyGoogleIdToken, getGoogleClientId } from '../services/googleAuthService.js';
import { sendTokenResponse } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { sendWelcomeEmail } from '../services/emailService.js';
import { getOrCreateWallet } from '../services/walletService.js';

/**
 * Helper to sanitize user object for responses
 */
const sanitizeUser = (user, hasPassword = false) => ({
  id: user._id,
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  phone: user.phone,
  isEmailVerified: user.isEmailVerified,
  billingAddress: user.billingAddress,
  authProviders: user.authProviders || ['local'],
  googleId: user.googleId || null,
  googleEmail: user.googleEmail || '',
  registrationMethod: user.registrationMethod || 'local',
  hasPassword: Boolean(hasPassword || (user.authProviders && user.authProviders.includes('local'))),
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

/**
 * Helper to append to user's login history
 */
const recordLogin = (user, req, provider = 'google') => {
  if (!user.loginHistory) user.loginHistory = [];
  user.loginHistory.unshift({
    provider,
    ip: req.ip || req.connection?.remoteAddress || '',
    userAgent: req.headers['user-agent'] || '',
    timestamp: new Date(),
    success: true,
  });
  // Keep last 50 login attempts
  if (user.loginHistory.length > 50) {
    user.loginHistory = user.loginHistory.slice(0, 50);
  }
  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip || req.connection?.remoteAddress || '';
};

/**
 * POST /api/auth/google
 * Authenticate or register using Google OAuth ID token
 */
export const googleAuth = async (req, res, next) => {
  try {
    const idToken = req.body.idToken || req.body.credential;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google authentication credential (idToken) is required',
      });
    }

    // Verify token with Google's API / OAuth2Client
    let googlePayload;
    try {
      googlePayload = await verifyGoogleIdToken(idToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: `Google authentication failed: ${err.message}`,
      });
    }

    const { sub, email, name, picture, email_verified } = googlePayload;

    // 1. Check if user already exists with this googleId
    let user = await User.findOne({ googleId: sub }).select('+password');

    if (user) {
      // Existing Google-linked user
      if (user.isBanned) {
        return res.status(403).json({
          success: false,
          message: `Account has been banned: ${user.bannedReason || 'Terms violation'}`,
        });
      }

      if (user.isSuspended) {
        return res.status(403).json({
          success: false,
          message: `Account is suspended: ${user.suspendedReason || 'Administrative review'}`,
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account has been deactivated. Please contact support.',
        });
      }

      // Sync avatar if user currently has none
      if (!user.avatar && picture) {
        user.avatar = picture;
      }
      if (!user.googleEmail) {
        user.googleEmail = email;
      }
      if (!user.authProviders.includes('google')) {
        user.authProviders.push('google');
      }

      recordLogin(user, req, 'google');
      await user.save();

      await logAudit({
        actor: user._id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'USER_LOGGED_IN_GOOGLE',
        entity: 'User',
        entityId: user._id.toString(),
        req,
      });

      return sendTokenResponse(user, 200, res, 'Logged in with Google successfully');
    }

    // 2. Check if user exists with the same email
    const existingByEmail = await User.findOne({ email }).select('+password');

    if (existingByEmail) {
      // Security Check: Never link without verified email from Google
      if (!email_verified) {
        return res.status(400).json({
          success: false,
          message: 'Google email is not verified. Account linking is restricted for security.',
        });
      }

      if (existingByEmail.isBanned) {
        return res.status(403).json({
          success: false,
          message: `Account has been banned: ${existingByEmail.bannedReason || 'Terms violation'}`,
        });
      }

      if (existingByEmail.isSuspended) {
        return res.status(403).json({
          success: false,
          message: `Account is suspended: ${existingByEmail.suspendedReason || 'Administrative review'}`,
        });
      }

      if (!existingByEmail.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account has been deactivated. Please contact support.',
        });
      }

      // Link Google identity to existing account
      existingByEmail.googleId = sub;
      existingByEmail.googleEmail = email;
      existingByEmail.googleProfile = {
        sub,
        name,
        picture,
        emailVerified: email_verified,
      };

      if (!existingByEmail.authProviders) existingByEmail.authProviders = ['local'];
      if (!existingByEmail.authProviders.includes('google')) {
        existingByEmail.authProviders.push('google');
      }

      if (!existingByEmail.avatar && picture) {
        existingByEmail.avatar = picture;
      }
      existingByEmail.isEmailVerified = true;

      recordLogin(existingByEmail, req, 'google');
      await existingByEmail.save();

      await logAudit({
        actor: existingByEmail._id,
        actorEmail: existingByEmail.email,
        actorRole: existingByEmail.role,
        action: 'USER_ACCOUNT_LINKED_GOOGLE',
        entity: 'User',
        entityId: existingByEmail._id.toString(),
        req,
      });

      return sendTokenResponse(existingByEmail, 200, res, 'Google account linked and logged in successfully');
    }

    // 3. New User Registration via Google
    user = await User.create({
      name: name || 'Google User',
      email: email.toLowerCase(),
      googleId: sub,
      googleEmail: email.toLowerCase(),
      googleProfile: {
        sub,
        name,
        picture,
        emailVerified: email_verified,
      },
      avatar: picture || '',
      role: 'customer',
      authProviders: ['google'],
      registrationMethod: 'google',
      isEmailVerified: Boolean(email_verified),
      lastLoginAt: new Date(),
      lastLoginIp: req.ip || req.connection?.remoteAddress || '',
      loginHistory: [
        {
          provider: 'google',
          ip: req.ip || req.connection?.remoteAddress || '',
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date(),
          success: true,
        },
      ],
    });

    // Ensure wallet is initialized
    await getOrCreateWallet(user._id).catch((err) =>
      console.error('Failed to initialize wallet for new Google user:', err.message)
    );

    // Send welcome email
    sendWelcomeEmail(user).catch((err) =>
      console.error('Failed to dispatch welcome email to new Google user:', err.message)
    );

    await logAudit({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_REGISTERED_GOOGLE',
      entity: 'User',
      entityId: user._id.toString(),
      req,
    });

    return sendTokenResponse(user, 201, res, 'Google registration successful');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/google/link
 * Link Google identity to the currently authenticated account
 */
export const linkGoogle = async (req, res, next) => {
  try {
    const idToken = req.body.idToken || req.body.credential;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required for linking',
      });
    }

    const googlePayload = await verifyGoogleIdToken(idToken);
    const { sub, email, name, picture, email_verified } = googlePayload;

    if (!email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Cannot link Google account: email is not verified by Google.',
      });
    }

    // Check if another account already has this Google ID
    const existingOther = await User.findOne({ googleId: sub });
    if (existingOther && existingOther._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'This Google account is already linked to another BundleByte account.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.googleId = sub;
    user.googleEmail = email;
    user.googleProfile = {
      sub,
      name,
      picture,
      emailVerified: email_verified,
    };

    if (!user.authProviders) user.authProviders = ['local'];
    if (!user.authProviders.includes('google')) {
      user.authProviders.push('google');
    }

    if (!user.avatar && picture) {
      user.avatar = picture;
    }

    await user.save();

    await logAudit({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_ACCOUNT_LINKED_GOOGLE',
      entity: 'User',
      entityId: user._id.toString(),
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Google account linked successfully',
      user: sanitizeUser(user, Boolean(user.password)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/auth/google/unlink
 * Unlink Google identity from authenticated account
 * Requires that another login method (e.g., password) is available
 */
export const unlinkGoogle = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.googleId) {
      return res.status(400).json({
        success: false,
        message: 'No Google account is currently linked to this profile.',
      });
    }

    const hasPassword = Boolean(user.password);
    const otherProviders = (user.authProviders || []).filter((p) => p !== 'google');

    // Security: Prevent unlinking if it's the only login method and no password exists
    if (!hasPassword && otherProviders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot unlink Google account. You must set a password on your account before unlinking Google.',
      });
    }

    user.googleId = null;
    user.googleEmail = '';
    user.googleProfile = undefined;
    user.authProviders = user.authProviders.filter((p) => p !== 'google');

    if (user.authProviders.length === 0 && hasPassword) {
      user.authProviders = ['local'];
    }

    await user.save();

    await logAudit({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_ACCOUNT_UNLINKED_GOOGLE',
      entity: 'User',
      entityId: user._id.toString(),
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Google account unlinked successfully',
      user: sanitizeUser(user, hasPassword),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/google/config
 * Returns public Google OAuth client configuration
 */
export const getGoogleConfig = async (req, res, next) => {
  try {
    const clientId = await getGoogleClientId();
    const setting = await WebsiteSetting.findOne();
    const enabled = setting?.authConfig?.google?.enabled !== false;

    res.status(200).json({
      success: true,
      clientId,
      enabled,
    });
  } catch (error) {
    next(error);
  }
};

