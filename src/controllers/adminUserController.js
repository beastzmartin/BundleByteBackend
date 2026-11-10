import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import DigitalDelivery from '../models/DigitalDelivery.js';
import Subscription from '../models/Subscription.js';
import SupportTicket from '../models/SupportTicket.js';
import AuditLog from '../models/AuditLog.js';
import { logAudit } from '../middleware/audit.js';
import { ENV } from '../config/environment.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

/**
 * GET /api/admin/users
 * Paginated list of users with multi-facet filters & telemetry
 */
export const getAdminUsers = async (req, res, next) => {
  try {
    const {
      search,
      role,
      status, // 'all', 'active', 'suspended', 'banned', 'inactive'
      isEmailVerified,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { phone: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (role && role !== 'all') {
      query.role = role;
    }

    if (status && status !== 'all') {
      if (status === 'banned') query.isBanned = true;
      else if (status === 'suspended') query.isSuspended = true;
      else if (status === 'active') {
        query.isActive = true;
        query.isBanned = { $ne: true };
        query.isSuspended = { $ne: true };
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }

    if (isEmailVerified !== undefined && isEmailVerified !== 'all') {
      query.isEmailVerified = isEmailVerified === 'true';
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [users, total, stats] = await Promise.all([
      User.find(query)
        .select('-password -mfaSecret')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(query),
      Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'customer' }),
        User.countDocuments({ isSuspended: true }),
        User.countDocuments({ isBanned: true }),
        User.countDocuments({ isEmailVerified: true }),
        User.countDocuments({ role: { $in: ['admin', 'super_admin', 'manager', 'support_agent', 'inventory_manager'] } }),
      ]),
    ]);

    // Attach high-level metrics for each listed user (order count, total spend, wallet balance)
    const enrichedUsers = await Promise.all(
      users.map(async (u) => {
        const [orderCount, paidOrders, wallet] = await Promise.all([
          Order.countDocuments({ user: u._id }),
          Order.find({ user: u._id, paymentStatus: 'paid' }).select('totalAmount'),
          Wallet.findOne({ user: u._id }).select('balance'),
        ]);

        const totalSpent = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        return {
          ...u.toObject(),
          orderCount,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          walletBalance: wallet ? +(wallet.balance / 100).toFixed(2) : 0,
        };
      })
    );

    res.status(200).json({
      success: true,
      users: enrichedUsers,
      total,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
      stats: {
        totalUsers: stats[0],
        customers: stats[1],
        suspended: stats[2],
        banned: stats[3],
        verified: stats[4],
        staff: stats[5],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/users/:id/360
 * Full 360° customer profile dossier
 */
export const getUser360Profile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password -mfaSecret');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [
      orders,
      wallet,
      walletTransactions,
      deliveries,
      subscriptions,
      tickets,
      auditLogs,
    ] = await Promise.all([
      Order.find({ user: id }).sort({ createdAt: -1 }).limit(25),
      Wallet.findOne({ user: id }),
      WalletTransaction.find({ user: id }).sort({ createdAt: -1 }).limit(15),
      DigitalDelivery.find({ user: id }).populate('product', 'title logo category').sort({ createdAt: -1 }).limit(25),
      Subscription.find({ user: id }).sort({ createdAt: -1 }),
      SupportTicket.find({ user: id }).sort({ createdAt: -1 }),
      AuditLog.find({
        $or: [{ actor: id }, { entityId: id.toString() }],
      })
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    // Financial aggregates
    const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');
    const totalSpent = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    res.status(200).json({
      success: true,
      dossier: {
        user,
        metrics: {
          totalOrders: orders.length,
          paidOrdersCount: paidOrders.length,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          walletBalance: wallet ? +(wallet.balance / 100).toFixed(2) : 0,
          activeSubscriptionsCount: subscriptions.filter((s) => s.status === 'active').length,
          totalDeliveredAssets: deliveries.length,
          openTicketsCount: tickets.filter((t) => t.status !== 'closed' && t.status !== 'resolved').length,
        },
        orders,
        wallet: wallet
          ? {
              balanceRupees: +(wallet.balance / 100).toFixed(2),
              totalAddedRupees: +(wallet.totalAdded / 100).toFixed(2),
              totalSpentRupees: +(wallet.totalSpent / 100).toFixed(2),
              totalCashbackRupees: +(wallet.totalCashback / 100).toFixed(2),
              isActive: wallet.isActive,
            }
          : null,
        walletTransactions,
        deliveries,
        subscriptions,
        tickets,
        auditLogs,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/users/:id/controls
 * Manage account lifecycle: activate, deactivate, suspend, ban, force reset
 */
export const updateAccountControls = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      isActive,
      isSuspended,
      suspendedReason,
      isBanned,
      bannedReason,
      forcePasswordReset,
      isEmailVerified,
    } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Protection: Prevent modifying super_admin unless acting user is super_admin
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only a Super Admin can modify another Super Admin account.',
      });
    }

    if (isActive !== undefined) user.isActive = Boolean(isActive);

    if (isSuspended !== undefined) {
      user.isSuspended = Boolean(isSuspended);
      if (user.isSuspended) {
        user.suspendedReason = suspendedReason || 'Suspended by administration';
        user.suspendedAt = new Date();
      } else {
        user.suspendedReason = '';
        user.suspendedAt = null;
      }
    }

    if (isBanned !== undefined) {
      user.isBanned = Boolean(isBanned);
      if (user.isBanned) {
        user.bannedReason = bannedReason || 'Permanent ban issued by administration';
        user.bannedAt = new Date();
        // Automatically revoke active tokens on ban
        user.tokenVersion = (user.tokenVersion || 0) + 1;
      } else {
        user.bannedReason = '';
        user.bannedAt = null;
      }
    }

    if (forcePasswordReset !== undefined) {
      user.forcePasswordReset = Boolean(forcePasswordReset);
    }

    if (isEmailVerified !== undefined) {
      user.isEmailVerified = Boolean(isEmailVerified);
    }

    await user.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'USER_ACCOUNT_CONTROLS_UPDATED',
      entity: 'User',
      entityId: user._id.toString(),
      details: {
        isActive: user.isActive,
        isSuspended: user.isSuspended,
        isBanned: user.isBanned,
        forcePasswordReset: user.forcePasswordReset,
      },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Account controls successfully updated',
      user: {
        _id: user._id,
        email: user.email,
        isActive: user.isActive,
        isSuspended: user.isSuspended,
        isBanned: user.isBanned,
        forcePasswordReset: user.forcePasswordReset,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:id/revoke-sessions
 * Instantly invalidate all JWT sessions by incrementing tokenVersion
 */
export const revokeUserSessions = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'USER_SESSIONS_REVOKED',
      entity: 'User',
      entityId: user._id.toString(),
      details: { newVersion: user.tokenVersion },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'All active sessions for this user have been instantly revoked.',
      newTokenVersion: user.tokenVersion,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/users/:id/role
 * Change user role across all 6 supported roles with permission barrier
 */
export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = [
      'super_admin',
      'admin',
      'manager',
      'support_agent',
      'inventory_manager',
      'customer',
    ];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role specified. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Role elevation guard: Only super_admin can assign admin or super_admin roles
    if (['super_admin', 'admin'].includes(role) && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only a Super Administrator can grant Admin or Super Admin privileges.',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const oldRole = user.role;
    user.role = role;
    // Bumping tokenVersion ensures user's next request refreshes with new role claims
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'USER_ROLE_CHANGED',
      entity: 'User',
      entityId: user._id.toString(),
      details: { previousRole: oldRole, newRole: role },
      req,
    });

    res.status(200).json({
      success: true,
      message: `User role updated from "${oldRole}" to "${role}"`,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:id/notes
 * Append an administrative audit note to user profile
 */
export const addAdminNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Note text cannot be empty' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.adminNotes.push({
      note: note.trim(),
      author: req.user._id,
      authorName: req.user.name || req.user.email,
      createdAt: new Date(),
    });

    await user.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'USER_ADMIN_NOTE_ADDED',
      entity: 'User',
      entityId: user._id.toString(),
      details: { noteLength: note.length },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Admin note recorded',
      adminNotes: user.adminNotes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/users/:id/password
 * Administrator sets a user's password directly
 */
export const adminChangeUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword, revokeSessions = true } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Role safety guard
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only a Super Administrator can change credentials of another Super Administrator.',
      });
    }

    user.password = newPassword;
    if (!user.authProviders) user.authProviders = [];
    if (!user.authProviders.includes('local')) user.authProviders.push('local');

    if (revokeSessions) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    user.forcePasswordReset = false;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ADMIN_MANUALLY_SET_USER_PASSWORD',
      entity: 'User',
      entityId: user._id.toString(),
      details: {
        targetUserEmail: user.email,
        revokedSessions: revokeSessions,
      },
      req,
    });

    res.status(200).json({
      success: true,
      message: `Password for ${user.name || user.email} has been successfully updated.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:id/impersonate
 * Administrator logs in as a user (Masquerade mode)
 */
export const adminImpersonateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You are already logged into your own account.',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to impersonate a Super Administrator.',
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Cannot log into a banned account. Please unban the user first.',
      });
    }

    const tokenPayload = {
      id: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
      impersonatedBy: req.user._id,
      impersonatorName: req.user.name,
      impersonatorEmail: req.user.email,
    };

    const token = jwt.sign(tokenPayload, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRE,
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ADMIN_USER_IMPERSONATION_STARTED',
      entity: 'User',
      entityId: user._id.toString(),
      details: {
        impersonatedUserEmail: user.email,
        impersonatedUserRole: user.role,
      },
      req,
    });

    const userSanitized = {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
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

    res.status(200).json({
      success: true,
      message: `Impersonation active. Logged in as ${user.name || user.email}.`,
      token,
      user: userSanitized,
      impersonator: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:id/send-reset-email
 * Dispatch password reset email to user from admin panel
 */
export const adminSendPasswordResetEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
    await user.save();

    sendPasswordResetEmail(user, resetToken).catch((err) =>
      console.error('Failed to send admin-triggered reset email:', err)
    );

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ADMIN_DISPATCHED_PASSWORD_RESET_EMAIL',
      entity: 'User',
      entityId: user._id.toString(),
      details: { targetEmail: user.email },
      req,
    });

    res.status(200).json({
      success: true,
      message: `Password reset instructions have been dispatched to ${user.email}.`,
    });
  } catch (error) {
    next(error);
  }
};
