import User from '../models/User.js';
import WebsiteSetting from '../models/WebsiteSetting.js';
import {
  verifyTelegramAuthData,
  getTelegramBotUsername,
} from '../services/telegramAuthService.js';
import { sendTokenResponse } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { getOrCreateWallet } from '../services/walletService.js';

/**
 * Helper to sanitize user object for client responses
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
  telegramId: user.telegramId || null,
  telegramUsername: user.telegramUsername || '',
  telegramConnectedAt: user.telegramConnectedAt || null,
  registrationMethod: user.registrationMethod || 'local',
  hasPassword: Boolean(hasPassword || (user.authProviders && user.authProviders.includes('local'))),
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

/**
 * Helper to record a Telegram login entry in user's telemetry history
 */
const recordLogin = (user, req) => {
  if (!user.loginHistory) user.loginHistory = [];
  user.loginHistory.unshift({
    provider: 'telegram',
    ip: req.ip || req.connection?.remoteAddress || '',
    userAgent: req.headers?.['user-agent'] || '',
    timestamp: new Date(),
    success: true,
  });
  if (user.loginHistory.length > 50) {
    user.loginHistory = user.loginHistory.slice(0, 50);
  }
  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip || req.connection?.remoteAddress || '';
};

/**
 * POST /api/auth/telegram
 * Authenticate or register using signed Telegram authentication data
 */
export const telegramAuth = async (req, res, next) => {
  try {
    const authData = req.body.authData || req.body;

    if (!authData || typeof authData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Telegram authentication data is required',
      });
    }

    // 1. Verify Telegram signature and validate timestamp window
    let verified;
    try {
      verified = await verifyTelegramAuthData(authData);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: `Telegram authentication failed: ${err.message}`,
      });
    }

    const { id, firstName, lastName, username, photoUrl, authDate } = verified;

    // 2. Look for existing account with this Telegram ID
    let user = await User.findOne({ telegramId: id }).select('+password');

    if (user) {
      // Existing Telegram account
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

      // Synchronize latest Telegram profile details
      if (username && user.telegramUsername !== username) {
        user.telegramUsername = username;
      }
      if (!user.avatar && photoUrl) {
        user.avatar = photoUrl;
      }
      if (!user.authProviders.includes('telegram')) {
        user.authProviders.push('telegram');
      }

      user.telegramProfile = {
        id,
        firstName,
        lastName,
        username,
        photoUrl,
        authDate,
      };

      recordLogin(user, req);
      await user.save();

      await logAudit({
        actor: user._id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'USER_LOGGED_IN_TELEGRAM',
        entity: 'User',
        entityId: user._id.toString(),
        req,
      });

      return sendTokenResponse(user, 200, res, 'Logged in with Telegram successfully');
    }

    // 3. New User Registration via Telegram
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || `Telegram User ${id}`;
    const generatedEmail = `tg_${id}@bundlebyte.com`;

    // Ensure email uniqueness in case of conflict
    let finalEmail = generatedEmail;
    const existingWithEmail = await User.findOne({ email: finalEmail });
    if (existingWithEmail) {
      finalEmail = `tg_${id}_${Date.now()}@bundlebyte.com`;
    }

    user = await User.create({
      name: displayName,
      email: finalEmail,
      telegramId: id,
      telegramUsername: username || '',
      telegramConnectedAt: new Date(),
      telegramProfile: {
        id,
        firstName,
        lastName,
        username,
        photoUrl,
        authDate,
      },
      avatar: photoUrl || '',
      role: 'customer',
      authProviders: ['telegram'],
      registrationMethod: 'telegram',
      isEmailVerified: false,
      lastLoginAt: new Date(),
      lastLoginIp: req.ip || req.connection?.remoteAddress || '',
      loginHistory: [
        {
          provider: 'telegram',
          ip: req.ip || req.connection?.remoteAddress || '',
          userAgent: req.headers?.['user-agent'] || '',
          timestamp: new Date(),
          success: true,
        },
      ],
    });

    // Initialize customer wallet
    await getOrCreateWallet(user._id).catch((err) =>
      console.error('Failed to initialize wallet for new Telegram user:', err.message)
    );

    await logAudit({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_REGISTERED_TELEGRAM',
      entity: 'User',
      entityId: user._id.toString(),
      req,
    });

    return sendTokenResponse(user, 201, res, 'Telegram registration successful');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/telegram/link
 * Connect Telegram identity to the currently authenticated user
 */
export const linkTelegram = async (req, res, next) => {
  try {
    const authData = req.body.authData || req.body;

    if (!authData || typeof authData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Telegram authentication data is required for account linking',
      });
    }

    const verified = await verifyTelegramAuthData(authData);
    const { id, firstName, lastName, username, photoUrl, authDate } = verified;

    // Check if another account already has this Telegram ID
    const existingOther = await User.findOne({ telegramId: id });
    if (existingOther && existingOther._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'This Telegram account is already linked to another BundleByte user.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.telegramId = id;
    user.telegramUsername = username || '';
    user.telegramConnectedAt = new Date();
    user.telegramProfile = {
      id,
      firstName,
      lastName,
      username,
      photoUrl,
      authDate,
    };

    if (!user.authProviders) user.authProviders = ['local'];
    if (!user.authProviders.includes('telegram')) {
      user.authProviders.push('telegram');
    }

    if (!user.avatar && photoUrl) {
      user.avatar = photoUrl;
    }

    await user.save();

    await logAudit({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_ACCOUNT_LINKED_TELEGRAM',
      entity: 'User',
      entityId: user._id.toString(),
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Telegram account linked successfully',
      user: sanitizeUser(user, Boolean(user.password)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/auth/telegram/unlink
 * Disconnect Telegram identity from authenticated user
 */
export const unlinkTelegram = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.telegramId) {
      return res.status(400).json({
        success: false,
        message: 'No Telegram account is currently linked to this profile.',
      });
    }

    const hasPassword = Boolean(user.password);
    const otherProviders = (user.authProviders || []).filter((p) => p !== 'telegram');

    // Security: Prevent unlinking if it's the only login method and no password exists
    if (!hasPassword && otherProviders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot unlink Telegram account. You must set a password or connect Google before unlinking your only authentication method.',
      });
    }

    user.telegramId = null;
    user.telegramUsername = '';
    user.telegramConnectedAt = null;
    user.telegramProfile = undefined;
    user.authProviders = user.authProviders.filter((p) => p !== 'telegram');

    if (user.authProviders.length === 0 && hasPassword) {
      user.authProviders = ['local'];
    }

    await user.save();

    await logAudit({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_ACCOUNT_UNLINKED_TELEGRAM',
      entity: 'User',
      entityId: user._id.toString(),
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Telegram account disconnected successfully',
      user: sanitizeUser(user, hasPassword),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/telegram/config
 * Returns public Telegram login configuration (bot username)
 */
export const getTelegramConfig = async (req, res, next) => {
  try {
    const botUsername = await getTelegramBotUsername();
    const setting = await WebsiteSetting.findOne();
    const enabled = setting?.authConfig?.telegram?.enabled !== false && Boolean(botUsername);

    res.status(200).json({
      success: true,
      botUsername,
      enabled,
    });
  } catch (error) {
    next(error);
  }
};

