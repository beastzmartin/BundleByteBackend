import crypto from 'crypto';
import User from '../models/User.js';
import { sendTokenResponse } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../services/emailService.js';

export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone: phone || '',
      role: 'customer',
    });

    await logAudit({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_REGISTERED',
      entity: 'User',
      entityId: user._id.toString(),
      req,
    });

    // Automated welcome email
    sendWelcomeEmail(user).catch((err) => console.error('Failed to dispatch welcome email:', err));

    sendTokenResponse(user, 201, res, 'Registration successful');
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email and password',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check brute-force lockout
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const waitMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
      return res.status(403).json({
        success: false,
        message: `Account is temporarily locked due to consecutive failed login attempts. Please try again in ${waitMinutes} minute(s).`,
      });
    }

    // Check account status
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

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lock
      }
      await user.save();

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Successful login: clear locks & update telemetry
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip || req.connection?.remoteAddress || '';
    await user.save();

    await logAudit({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_LOGGED_IN',
      entity: 'User',
      entityId: user._id.toString(),
      req,
    });

    sendTokenResponse(user, 200, res, 'Logged in successfully');
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: 'User logged out successfully',
  });
};

export const getMe = async (req, res) => {
  const user = await User.findById(req.user.id).select('+password');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  const userObj = user.toObject();
  userObj.hasPassword = Boolean(user.password);
  delete userObj.password;
  delete userObj.mfaSecret;

  userObj.isTeamMember = user.role !== 'customer';

  res.status(200).json({
    success: true,
    user: userObj,
  });
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, billingAddress, avatar } = req.body;

    const fieldsToUpdate = {};
    if (name) fieldsToUpdate.name = name;
    if (phone !== undefined) fieldsToUpdate.phone = phone;
    if (avatar !== undefined) fieldsToUpdate.avatar = avatar;
    if (billingAddress) fieldsToUpdate.billingAddress = billingAddress;

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the new password',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    // If account already has a password, verify current password
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Please provide your current password',
        });
      }
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }
    }

    user.password = newPassword;
    if (!user.authProviders) {
      user.authProviders = [];
    }
    if (!user.authProviders.includes('local')) {
      user.authProviders.push('local');
    }
    await user.save();

    await logAudit({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: user.password ? 'PASSWORD_UPDATED' : 'PASSWORD_CREATED',
      entity: 'User',
      entityId: user._id.toString(),
      req,
    });

    sendTokenResponse(user, 200, res, user.password ? 'Password updated successfully' : 'Password created successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/updateemail
 * Update user or admin primary email with password verification
 */
export const updateEmail = async (req, res, next) => {
  try {
    const { newEmail, currentPassword } = req.body;

    if (!newEmail || !newEmail.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid new email address',
      });
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email format',
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.email.toLowerCase() === cleanEmail) {
      return res.status(400).json({
        success: false,
        message: 'New email address must be different from current email',
      });
    }

    // Verify current password if user has password
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to change your account email',
        });
      }
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }
    }

    // Check if new email is already taken
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This email address is already registered to another account',
      });
    }

    const oldEmail = user.email;
    user.email = cleanEmail;
    await user.save();

    await logAudit({
      actor: user._id,
      actorEmail: oldEmail,
      actorRole: user.role,
      action: 'EMAIL_UPDATED',
      entity: 'User',
      entityId: user._id.toString(),
      metadata: { oldEmail, newEmail: cleanEmail },
      req,
    }).catch(() => {});

    sendTokenResponse(user, 200, res, `Account email updated successfully to ${cleanEmail}`);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password
 * Send secure password reset link
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return 200 to prevent user enumeration attacks
      return res.status(200).json({
        success: true,
        message: 'If an account exists with that email address, password reset instructions have been sent.',
      });
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    sendPasswordResetEmail(user, resetToken).catch((err) => console.error('Failed to send reset email:', err));

    res.status(200).json({
      success: true,
      message: 'Password reset link has been dispatched to your email address.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password/:token
 * Reset password using token
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.forcePasswordReset = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all prior sessions
    await user.save();

    await logAudit({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'PASSWORD_RESET_SUCCESSFUL',
      entity: 'User',
      entityId: user._id.toString(),
      req,
    });

    sendTokenResponse(user, 200, res, 'Password reset successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/verify-email/:token
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Verification token is invalid or expired' });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpire = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email address verified successfully!',
    });
  } catch (error) {
    next(error);
  }
};

