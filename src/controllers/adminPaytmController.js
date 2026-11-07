import PaytmMerchant from '../models/PaytmMerchant.js';
import MerchantRoutingConfig from '../models/MerchantRoutingConfig.js';
import PaymentAttempt from '../models/PaymentAttempt.js';
import TransactionReconciliation from '../models/TransactionReconciliation.js';
import { encryptCredential } from '../utils/credentialEncryption.js';
import { queryPaytmOrderStatus } from '../services/payment/paytmService.js';
import { fulfillSuccessfulPaytmPayment } from '../services/payment/paytmCronService.js';
import { getOrCreateRoutingConfig } from '../services/payment/paytmRoutingEngine.js';
import { logAudit } from '../middleware/audit.js';

/**
 * GET /api/admin/paytm/merchants
 * List all Paytm merchant accounts
 */
export const getMerchants = async (req, res, next) => {
  try {
    const merchants = await PaytmMerchant.find({ isDeleted: false }).sort({ priority: 1, createdAt: -1 });

    const safeMerchants = merchants.map((m) => {
      const obj = m.toObject();
      return {
        ...obj,
        hasKey: true,
        merchantKeyMasked: '••••••••••••••••',
      };
    });

    res.status(200).json({
      success: true,
      merchants: safeMerchants,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/paytm/merchants
 * Create a new Paytm merchant account
 */
export const createMerchant = async (req, res, next) => {
  try {
    const {
      merchantName,
      mid,
      merchantKey,
      upiId,
      websiteName = 'DEFAULT',
      industryType = 'Retail',
      channelId = 'WEB',
      environment = 'production',
      priority = 1,
      minAmount = 1,
      maxAmount = 100000,
      dailyLimit = 100000,
      notes = '',
    } = req.body;

    if (!merchantName || !mid || !merchantKey || !upiId) {
      return res.status(400).json({
        success: false,
        message: 'Merchant Name, MID, Merchant Key, and UPI ID are required.',
      });
    }

    const existingMid = await PaytmMerchant.findOne({ mid: mid.trim(), isDeleted: false });
    if (existingMid) {
      return res.status(400).json({
        success: false,
        message: `A merchant with MID "${mid.trim()}" already exists.`,
      });
    }

    // Encrypt merchant key with AES-256-GCM
    const encryptedKey = encryptCredential(merchantKey.trim());

    const merchant = await PaytmMerchant.create({
      merchantName: merchantName.trim(),
      mid: mid.trim(),
      merchantKey: encryptedKey,
      upiId: upiId.trim(),
      websiteName: websiteName.trim(),
      industryType: industryType.trim(),
      channelId: channelId.trim(),
      environment,
      priority: Number(priority) || 1,
      minAmount: Number(minAmount) || 1,
      maxAmount: Number(maxAmount) || 100000,
      dailyLimit: Number(dailyLimit) || 100000,
      notes: notes.trim(),
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'PAYTM_MERCHANT_CREATED',
      entity: 'PaytmMerchant',
      entityId: merchant._id.toString(),
      details: { mid: merchant.mid, merchantName: merchant.merchantName },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Paytm merchant created successfully with encrypted credentials.',
      merchant: {
        ...merchant.toObject(),
        merchantKeyMasked: '••••••••••••••••',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/paytm/merchants/:id
 * Update an existing Paytm merchant
 */
export const updateMerchant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      merchantName,
      mid,
      merchantKey,
      upiId,
      websiteName,
      industryType,
      channelId,
      environment,
      status,
      priority,
      minAmount,
      maxAmount,
      dailyLimit,
      notes,
    } = req.body;

    const merchant = await PaytmMerchant.findById(id).select('+merchantKey');
    if (!merchant || merchant.isDeleted) {
      return res.status(404).json({ success: false, message: 'Merchant not found' });
    }

    if (merchantName !== undefined) merchant.merchantName = merchantName.trim();
    if (mid !== undefined) merchant.mid = mid.trim();
    if (upiId !== undefined) merchant.upiId = upiId.trim();
    if (websiteName !== undefined) merchant.websiteName = websiteName.trim();
    if (industryType !== undefined) merchant.industryType = industryType.trim();
    if (channelId !== undefined) merchant.channelId = channelId.trim();
    if (environment !== undefined) merchant.environment = environment;
    if (status !== undefined) merchant.status = status;
    if (priority !== undefined) merchant.priority = Number(priority);
    if (minAmount !== undefined) merchant.minAmount = Number(minAmount);
    if (maxAmount !== undefined) merchant.maxAmount = Number(maxAmount);
    if (dailyLimit !== undefined) merchant.dailyLimit = Number(dailyLimit);
    if (notes !== undefined) merchant.notes = notes.trim();

    // Encrypt new key if provided and not masked
    if (merchantKey && !merchantKey.includes('••••')) {
      merchant.merchantKey = encryptCredential(merchantKey.trim());
    }

    await merchant.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'PAYTM_MERCHANT_UPDATED',
      entity: 'PaytmMerchant',
      entityId: merchant._id.toString(),
      details: { mid: merchant.mid, merchantName: merchant.merchantName },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Paytm merchant updated successfully.',
      merchant: {
        ...merchant.toObject(),
        merchantKeyMasked: '••••••••••••••••',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/paytm/merchants/:id
 * Soft delete or remove merchant
 */
export const deleteMerchant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const merchant = await PaytmMerchant.findById(id);
    if (!merchant || merchant.isDeleted) {
      return res.status(404).json({ success: false, message: 'Merchant not found' });
    }

    merchant.isDeleted = true;
    merchant.status = 'disabled';
    await merchant.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'PAYTM_MERCHANT_DELETED',
      entity: 'PaytmMerchant',
      entityId: merchant._id.toString(),
      details: { mid: merchant.mid },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Paytm merchant removed successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/paytm/merchants/:id/status
 * Toggle active / disabled status
 */
export const toggleMerchantStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const merchant = await PaytmMerchant.findById(id);
    if (!merchant || merchant.isDeleted) {
      return res.status(404).json({ success: false, message: 'Merchant not found' });
    }

    const newStatus = status || (merchant.status === 'active' ? 'disabled' : 'active');
    merchant.status = newStatus;
    await merchant.save();

    res.status(200).json({
      success: true,
      message: `Merchant status changed to ${newStatus}.`,
      status: merchant.status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/paytm/routing
 * Get Multi-Merchant Routing configuration
 */
export const getRoutingConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateRoutingConfig();
    const merchants = await PaytmMerchant.find({ isDeleted: false, status: 'active' }).select('merchantName mid priority');

    res.status(200).json({
      success: true,
      config,
      availableMerchants: merchants,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/paytm/routing
 * Update Multi-Merchant Routing configuration
 */
export const updateRoutingConfig = async (req, res, next) => {
  try {
    const { routingStrategy, manualMerchant, amountBrackets, failoverOrder, enableAutomaticFailover } = req.body;

    let config = await MerchantRoutingConfig.findOne();
    if (!config) {
      config = await MerchantRoutingConfig.create({});
    }

    if (routingStrategy !== undefined) config.routingStrategy = routingStrategy;
    if (manualMerchant !== undefined) config.manualMerchant = manualMerchant || null;
    if (amountBrackets !== undefined) config.amountBrackets = amountBrackets;
    if (failoverOrder !== undefined) config.failoverOrder = failoverOrder;
    if (enableAutomaticFailover !== undefined) config.enableAutomaticFailover = enableAutomaticFailover;

    config.updatedBy = req.user._id;
    await config.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'PAYTM_ROUTING_CONFIG_UPDATED',
      entity: 'MerchantRoutingConfig',
      entityId: config._id.toString(),
      details: { routingStrategy: config.routingStrategy },
      req,
    });

    const populated = await MerchantRoutingConfig.findById(config._id).populate('manualMerchant failoverOrder amountBrackets.merchant');

    res.status(200).json({
      success: true,
      message: 'Paytm Multi-Merchant Routing configuration updated successfully.',
      config: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/paytm/transactions
 * Retrieve paginated payment transactions with search and filters
 */
export const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', status = 'all', merchantId = 'all', startDate, endDate } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status.toUpperCase();
    }

    if (merchantId && merchantId !== 'all') {
      query.merchant = merchantId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { merchantOrderId: { $regex: term, $options: 'i' } },
        { paytmTxnRef: { $regex: term, $options: 'i' } },
        { paytmTxnId: { $regex: term, $options: 'i' } },
        { bankTxnId: { $regex: term, $options: 'i' } },
        { paytmMid: { $regex: term, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await PaymentAttempt.countDocuments(query);
    const transactions = await PaymentAttempt.find(query)
      .populate('merchant', 'merchantName mid')
      .populate('order', 'orderNumber totalAmount customerName customerEmail')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/paytm/reconciliation
 * Summary and reconciliation metrics
 */
export const getReconciliationReport = async (req, res, next) => {
  try {
    const totalTransactions = await PaymentAttempt.countDocuments();
    const successfulTransactions = await PaymentAttempt.countDocuments({ status: 'TXN_SUCCESS' });
    const failedTransactions = await PaymentAttempt.countDocuments({ status: 'TXN_FAILURE' });
    const pendingTransactions = await PaymentAttempt.countDocuments({ status: 'PENDING' });

    // Aggregate volume
    const volumeAgg = await PaymentAttempt.aggregate([
      { $match: { status: 'TXN_SUCCESS' } },
      { $group: { _id: null, totalVolume: { $sum: '$amount' } } },
    ]);
    const totalVolume = volumeAgg[0]?.totalVolume || 0;

    // Merchant-wise breakdown
    const merchantStats = await PaymentAttempt.aggregate([
      {
        $group: {
          _id: '$merchant',
          merchantName: { $first: '$merchantName' },
          mid: { $first: '$paytmMid' },
          totalCount: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ['$status', 'TXN_SUCCESS'] }, 1, 0] },
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'TXN_FAILURE'] }, 1, 0] },
          },
          totalAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'TXN_SUCCESS'] }, '$amount', 0] },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      metrics: {
        totalTransactions,
        successfulTransactions,
        failedTransactions,
        pendingTransactions,
        totalVolume,
        successRate: totalTransactions > 0 ? Math.round((successfulTransactions / totalTransactions) * 100) : 100,
      },
      merchantStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/paytm/recheck/:paymentId
 * Admin manually forces status check against Paytm API
 */
export const recheckTransaction = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const attempt = await PaymentAttempt.findById(paymentId);
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const merchant = await PaytmMerchant.findById(attempt.merchant).select('+merchantKey');
    if (!merchant) {
      return res.status(400).json({ success: false, message: 'Merchant account not found' });
    }

    const liveCheck = await queryPaytmOrderStatus({
      mid: attempt.paytmMid,
      merchantKey: merchant.merchantKey,
      orderId: attempt.paytmTxnRef,
      environment: merchant.environment,
    });

    if (liveCheck.isSuccess) {
      await fulfillSuccessfulPaytmPayment(attempt, liveCheck, merchant, 'admin_manual');
      return res.status(200).json({
        success: true,
        message: 'Transaction successfully verified and fulfilled!',
        status: 'TXN_SUCCESS',
        txnId: liveCheck.txnId,
        bankTxnId: liveCheck.bankTxnId,
      });
    }

    res.status(200).json({
      success: true,
      message: `Paytm reported status: ${liveCheck.rawStatus || 'PENDING'}`,
      status: liveCheck.normalizedStatus,
      rawResponse: liveCheck.rawResponse,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/paytm/export-csv
 * Financial CSV export of transactions
 */
export const exportTransactionsCSV = async (req, res, next) => {
  try {
    const transactions = await PaymentAttempt.find()
      .populate('order', 'orderNumber')
      .populate('user', 'email name')
      .sort({ createdAt: -1 })
      .limit(1000);

    let csv =
      'Payment ID,Order Number,Customer Name,Customer Email,Merchant Name,MID,Paytm Txn ID,Bank UTR,Amount (INR),Status,Initiated At,Verified At\n';

    for (const t of transactions) {
      const row = [
        `"${t._id}"`,
        `"${t.order?.orderNumber || t.walletTopupRef || 'N/A'}"`,
        `"${t.user?.name || 'Customer'}"`,
        `"${t.user?.email || 'N/A'}"`,
        `"${t.merchantName || ''}"`,
        `"${t.paytmMid || ''}"`,
        `"${t.paytmTxnId || ''}"`,
        `"${t.bankTxnId || ''}"`,
        t.amount.toFixed(2),
        `"${t.status}"`,
        `"${t.createdAt.toISOString()}"`,
        `"${t.verifiedAt ? t.verifiedAt.toISOString() : ''}"`,
      ].join(',');
      csv += `${row}\n`;
    }

    res.header('Content-Type', 'text/csv');
    res.attachment(`paytm-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

