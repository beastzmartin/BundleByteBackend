import User from '../models/User.js';
import Order from '../models/Order.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import DigitalDelivery from '../models/DigitalDelivery.js';
import Subscription from '../models/Subscription.js';
import SupportTicket from '../models/SupportTicket.js';
import AuditLog from '../models/AuditLog.js';
import { logAudit } from '../middleware/audit.js';

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
