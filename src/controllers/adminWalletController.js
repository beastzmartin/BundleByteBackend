import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import User from '../models/User.js';
import {
  getOrCreateWallet,
  creditWallet,
  debitWallet,
  reconcileWallet,
} from '../services/walletService.js';
import { logAudit } from '../middleware/audit.js';

/**
 * GET /api/admin/wallets
 * List all customer wallets with search, stats, and pagination
 */
export const getAllWallets = async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 15 } = req.query;

    let userQuery = { role: 'customer' };
    if (search.trim()) {
      userQuery = {
        role: 'customer',
        $or: [
          { name: { $regex: search.trim(), $options: 'i' } },
          { email: { $regex: search.trim(), $options: 'i' } },
        ],
      };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Find users
    const [matchingUsers, totalUsers] = await Promise.all([
      User.find(userQuery).select('name email avatar createdAt').skip(skip).limit(limitNum),
      User.countDocuments(userQuery),
    ]);

    const userIds = matchingUsers.map((u) => u._id);
    const wallets = await Wallet.find({ user: { $in: userIds } });

    const walletMap = new Map();
    wallets.forEach((w) => walletMap.set(w.user.toString(), w));

    const records = matchingUsers.map((u) => {
      const w = walletMap.get(u._id.toString());
      return {
        user: u,
        wallet: w
          ? {
              _id: w._id,
              balancePaise: w.balance,
              balanceRupees: +(w.balance / 100).toFixed(2),
              totalAddedRupees: +(w.totalAdded / 100).toFixed(2),
              totalSpentRupees: +(w.totalSpent / 100).toFixed(2),
              totalCashbackRupees: +(w.totalCashback / 100).toFixed(2),
              isActive: w.isActive,
            }
          : {
              balancePaise: 0,
              balanceRupees: 0,
              totalAddedRupees: 0,
              totalSpentRupees: 0,
              totalCashbackRupees: 0,
              isActive: true,
            },
      };
    });

    // Overall platform statistics
    const statsAggregation = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          totalPlatformBalancePaise: { $sum: '$balance' },
          totalPlatformAddedPaise: { $sum: '$totalAdded' },
          totalPlatformSpentPaise: { $sum: '$totalSpent' },
          totalPlatformCashbackPaise: { $sum: '$totalCashback' },
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = statsAggregation[0] || {
      totalPlatformBalancePaise: 0,
      totalPlatformAddedPaise: 0,
      totalPlatformSpentPaise: 0,
      totalPlatformCashbackPaise: 0,
      count: 0,
    };

    res.status(200).json({
      success: true,
      records,
      stats: {
        totalWallets: stats.count || totalUsers,
        totalBalanceRupees: +((stats.totalPlatformBalancePaise || 0) / 100).toFixed(2),
        totalAddedRupees: +((stats.totalPlatformAddedPaise || 0) / 100).toFixed(2),
        totalSpentRupees: +((stats.totalPlatformSpentPaise || 0) / 100).toFixed(2),
        totalCashbackRupees: +((stats.totalPlatformCashbackPaise || 0) / 100).toFixed(2),
      },
      pagination: {
        total: totalUsers,
        page: pageNum,
        pages: Math.ceil(totalUsers / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/wallets/:userId
 * Get user wallet details, transactions, and audit ledger reconciliation
 */
export const getUserWalletDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('name email role avatar createdAt');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const wallet = await getOrCreateWallet(userId);
    const transactions = await WalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('adminUser', 'name email')
      .populate('relatedOrder', 'orderNumber totalAmount');

    // Run reconciliation check
    const reconciliation = await reconcileWallet(userId);

    res.status(200).json({
      success: true,
      user,
      wallet: {
        _id: wallet._id,
        balancePaise: wallet.balance,
        balanceRupees: +(wallet.balance / 100).toFixed(2),
        totalAddedRupees: +(wallet.totalAdded / 100).toFixed(2),
        totalSpentRupees: +(wallet.totalSpent / 100).toFixed(2),
        totalCashbackRupees: +(wallet.totalCashback / 100).toFixed(2),
        isActive: wallet.isActive,
      },
      transactions,
      reconciliation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/wallets/:userId/credit
 * Manual wallet credit by administrator with mandatory reason
 */
export const adminCreditWallet = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid credit amount' });
    }

    if (!reason || !reason.trim() || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory reason of at least 5 characters is required for auditing purposes',
      });
    }

    const amountPaise = Math.round(amountNum * 100);

    const { wallet, transaction } = await creditWallet({
      userId,
      amountPaise,
      type: 'admin_credit',
      description: `Admin Credit: ${reason.trim()}`,
      adminUser: req.user._id,
      adminReason: reason.trim(),
      metadata: { creditedByAdmin: req.user.email },
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ADMIN_WALLET_CREDIT',
      entity: 'Wallet',
      entityId: wallet._id.toString(),
      details: { targetUserId: userId, amountPaise, reason: reason.trim() },
      req,
    });

    res.status(200).json({
      success: true,
      message: `Successfully credited ₹${amountNum.toFixed(2)} to customer wallet.`,
      wallet: {
        balancePaise: wallet.balance,
        balanceRupees: +(wallet.balance / 100).toFixed(2),
      },
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/wallets/:userId/debit
 * Manual wallet debit by administrator with mandatory reason
 */
export const adminDebitWallet = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid debit amount' });
    }

    if (!reason || !reason.trim() || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory reason of at least 5 characters is required for auditing purposes',
      });
    }

    const amountPaise = Math.round(amountNum * 100);

    const { wallet, transaction } = await debitWallet({
      userId,
      amountPaise,
      type: 'admin_debit',
      description: `Admin Debit: ${reason.trim()}`,
      adminUser: req.user._id,
      adminReason: reason.trim(),
      metadata: { debitedByAdmin: req.user.email },
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ADMIN_WALLET_DEBIT',
      entity: 'Wallet',
      entityId: wallet._id.toString(),
      details: { targetUserId: userId, amountPaise, reason: reason.trim() },
      req,
    });

    res.status(200).json({
      success: true,
      message: `Successfully debited ₹${amountNum.toFixed(2)} from customer wallet.`,
      wallet: {
        balancePaise: wallet.balance,
        balanceRupees: +(wallet.balance / 100).toFixed(2),
      },
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/wallets/export
 * Export wallet transaction ledger report as CSV
 */
export const exportWalletLedgerCSV = async (req, res, next) => {
  try {
    const transactions = await WalletTransaction.find()
      .sort({ createdAt: -1 })
      .populate('user', 'name email')
      .populate('adminUser', 'name email')
      .populate('relatedOrder', 'orderNumber');

    const csvHeaders = [
      'Transaction ID',
      'Date & Time',
      'Customer Name',
      'Customer Email',
      'Type',
      'Amount (INR)',
      'Previous Balance (INR)',
      'New Balance (INR)',
      'Status',
      'Related Order',
      'Admin / Author',
      'Reason / Description',
    ].join(',');

    const csvRows = transactions.map((t) => {
      const customerName = t.user?.name ? `"${t.user.name.replace(/"/g, '""')}"` : 'N/A';
      const customerEmail = t.user?.email || 'N/A';
      const date = new Date(t.createdAt).toISOString();
      const amount = (t.amount / 100).toFixed(2);
      const prevBal = (t.previousBalance / 100).toFixed(2);
      const newBal = (t.newBalance / 100).toFixed(2);
      const orderNum = t.relatedOrder?.orderNumber ? `#${t.relatedOrder.orderNumber}` : '-';
      const admin = t.adminUser?.email || '-';
      const desc = `"${(t.description || t.adminReason || '').replace(/"/g, '""')}"`;

      return [
        t.transactionId,
        date,
        customerName,
        customerEmail,
        t.type,
        amount,
        prevBal,
        newBal,
        t.status,
        orderNum,
        admin,
        desc,
      ].join(',');
    });

    const csvContent = [csvHeaders, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bundlebyte-wallet-ledger-${Date.now()}.csv"`
    );
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

