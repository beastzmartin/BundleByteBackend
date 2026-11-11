import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ENV } from '../config/environment.js';

export const protect = async (req, res, next) => {
  let token;

  // 1. Check HTTP-only cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Check Authorization Bearer header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 3. Check Query parameter token (for direct file downloads, exports, and window.open)
  else if (req.query && (req.query.token || req.query.auth_token)) {
    token = req.query.token || req.query.auth_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route. Please login.',
    });
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // Check account status
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: `Account has been banned. Reason: ${user.bannedReason || 'Terms violation'}`,
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: `Account is suspended. Reason: ${user.suspendedReason || 'Administrative review'}`,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // Token Version Revocation Check (Instant Session Invalidation)
    if (decoded.tokenVersion !== undefined && user.tokenVersion > decoded.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Active session was revoked by security policy. Please log in again.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token. Please log in again.',
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user && user.isActive && !user.isBanned && !user.isSuspended) {
        if (decoded.tokenVersion === undefined || user.tokenVersion <= decoded.tokenVersion) {
          req.user = user;
        }
      }
    } catch (err) {
      // Ignore token error in optional auth
    }
  }
  next();
};

export const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const tokenPayload = {
    id: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion || 0,
  };

  const token = jwt.sign(tokenPayload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRE,
  });

  const cookieOptions = {
    expires: new Date(Date.now() + ENV.COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  const staffRoles = ['super_admin', 'admin', 'manager', 'inventory_manager', 'support_agent'];
  const userSanitized = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isTeamMember: staffRoles.includes(user.role),
    avatar: user.avatar,
    phone: user.phone,
    isEmailVerified: user.isEmailVerified,
    billingAddress: user.billingAddress,
    createdAt: user.createdAt,
    authProviders: user.authProviders || ['local'],
    googleId: user.googleId || null,
    googleEmail: user.googleEmail || '',
    telegramId: user.telegramId || null,
    telegramUsername: user.telegramUsername || '',
    registrationMethod: user.registrationMethod || 'local',
    hasPassword: Boolean(user.password || (user.authProviders && user.authProviders.includes('local'))),
  };

  res.status(statusCode).cookie('token', token, cookieOptions).json({
    success: true,
    message,
    token,
    user: userSanitized,
  });
};

export const adminOnly = (req, res, next) => {
  const allowedAdminRoles = [
    'super_admin',
    'admin',
    'manager',
    'inventory_manager',
    'support_agent',
  ];
  if (!req.user || !allowedAdminRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Administrative privileges required',
    });
  }
  next();
};

export const requireAdmin = adminOnly;

export const superAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Super Administrator privileges required',
    });
  }
  next();
};

export const optionalProtect = async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.isActive && !user.isBanned) {
      req.user = user;
    }
  } catch (err) {}
  next();
};

export { authorize } from './roles.js';

