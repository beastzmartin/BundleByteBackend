import WebsiteSetting from '../models/WebsiteSetting.js';
import PaymentVerification from '../models/PaymentVerification.js';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import TrustedPaymentRecord from '../models/TrustedPaymentRecord.js';
import {
  testBinanceConnection,
  fetchBinanceDepositHistory,
  fetchBinanceDepositAddress,
  getBinanceCredentials,
} from '../services/payment/binanceService.js';
import { processOrderKeyDelivery } from '../services/keyDeliveryEngine.js';
import { creditWallet } from '../services/walletService.js';
import { encryptCredential, decryptCredential } from '../utils/credentialEncryption.js';
import { logAudit } from '../middleware/audit.js';
import { sendWalletTopupEmail } from '../services/emailService.js';

/**
 * GET /api/admin/binance/status
 * Check Binance connection status, configuration status, and health
 */
export const getBinanceStatus = async (req, res, next) => {
  try {
    const creds = await getBinanceCredentials();
    const connectionTest = await testBinanceConnection();

    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      PaymentVerification.countDocuments({ status: 'pending' }),
      PaymentVerification.countDocuments({ status: 'approved' }),
      PaymentVerification.countDocuments({ status: 'rejected' }),
    ]);

    res.status(200).json({
      success: true,
      status: connectionTest.status,
      connected: connectionTest.connected,
      isConfigured: connectionTest.isConfigured,
      message: connectionTest.message,
      accountType: connectionTest.accountType || 'SPOT',
      permissions: connectionTest.permissions || [],
      depositAddress: creds.depositAddress,
      network: creds.network,
      hasApiKey: !!creds.apiKey,
      hasApiSecret: !!creds.apiSecret,
      apiKeyMasked: creds.apiKey ? `${creds.apiKey.slice(0, 6)}••••••••${creds.apiKey.slice(-4)}` : '',
      autoVerifyEnabled: creds.autoVerifyEnabled,
      rates: {
        usdtToUsd: creds.usdtToUsdRate,
        usdtToInr: creds.usdtToInrRate,
      },
      stats: {
        pendingCount,
        approvedCount,
        rejectedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/binance/deposits
 * Retrieve live deposit history directly from official Binance API
 */
export const getBinanceLiveDeposits = async (req, res, next) => {
  try {
    const { coin = 'USDT', status = 1, limit = 50 } = req.query;
    const historyRes = await fetchBinanceDepositHistory({
      coin,
      status: status === 'all' ? undefined : Number(status),
      limit: Number(limit) || 50,
    });

    // Check which deposits have been matched in our system
    let enrichedDeposits = historyRes.deposits || [];
    if (enrichedDeposits.length > 0) {
      const txIds = enrichedDeposits.map((d) => d.txId).filter(Boolean);
      const matchedClaims = await PaymentVerification.find({
        transactionId: { $in: txIds },
      }).populate('order', 'orderNumber totalAmount customerName');

      const matchMap = new Map();
      matchedClaims.forEach((c) => matchMap.set(c.transactionId.toLowerCase(), c));

      enrichedDeposits = enrichedDeposits.map((dep) => {
        const match = dep.txId ? matchMap.get(dep.txId.toLowerCase()) : null;
        return {
          ...dep,
          isMatched: !!match,
          matchedClaim: match
            ? {
                _id: match._id,
                orderNumber: match.order?.orderNumber,
                status: match.status,
                customerName: match.order?.customerName,
              }
            : null,
        };
      });
    }

    res.status(200).json({
      success: historyRes.success,
      count: enrichedDeposits.length,
      deposits: enrichedDeposits,
      message: historyRes.message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/binance/verifications
 * Paginated list of payment verifications (Binance TxID & UPI UTR)
 */
export const getVerifications = async (req, res, next) => {
  try {
    const { status = 'all', paymentType = 'all', search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }
    if (paymentType && paymentType !== 'all') {
      query.paymentType = paymentType;
    }
    if (search && search.trim()) {
      query.$or = [
        { transactionId: { $regex: search.trim(), $options: 'i' } },
        { referenceCode: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [verifications, total] = await Promise.all([
      PaymentVerification.find(query)
        .populate('order', 'orderNumber totalAmount currency customerName customerEmail items paymentStatus deliveryStatus')
        .populate('user', 'name email phone')
        .populate('verifiedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      PaymentVerification.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      verifications,
      meta: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/binance/verify/:id/approve
 * Manually approve a pending verification (Binance TxID or UPI UTR) and fulfill order/wallet
 */
export const approveVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const verification = await PaymentVerification.findById(id).populate('order').populate('user');
    if (!verification) {
      return res.status(404).json({ success: false, message: 'Payment verification claim not found' });
    }

    if (verification.status === 'approved') {
      return res.status(400).json({ success: false, message: 'This transaction has already been approved' });
    }

    verification.status = 'approved';
    verification.verificationSource = 'admin_manual';
    verification.verifiedBy = req.user._id;
    verification.verifiedAt = new Date();
    if (notes) verification.adminNotes = notes;
    await verification.save();

    let deliveredResult = null;

    // Handle Order Fulfillment
    if (verification.order) {
      const order = await Order.findById(verification.order._id || verification.order);
      if (order && order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.paymentDetails = {
          transactionId: verification.transactionId,
          gateway: verification.paymentType === 'binance_usdt' ? 'binance' : 'upi',
          paidAt: new Date(),
        };
        await order.save();

        const customer = await User.findById(order.user);
        deliveredResult = await processOrderKeyDelivery(order, customer);
      }
    }

    // Handle Wallet Top-Up Credit
    if (verification.isWalletTopup && verification.walletAmountPaise > 0) {
      const creditRes = await creditWallet({
        userId: verification.user._id || verification.user,
        amountPaise: verification.walletAmountPaise,
        type: 'topup',
        description: `Manual approval: ${verification.paymentType === 'binance_usdt' ? 'Binance USDT' : 'UPI'} Top-Up (TxID: ${verification.transactionId})`,
        metadata: {
          verificationId: verification._id,
          transactionId: verification.transactionId,
          paymentType: verification.paymentType,
        },
      });

      const customerUser = await User.findById(verification.user._id || verification.user);
      if (customerUser) {
        sendWalletTopupEmail(
          customerUser,
          verification.amount,
          +(creditRes.wallet.balance / 100).toFixed(2)
        ).catch((err) => console.error('Wallet topup email error:', err.message));
      }
    }

    // Update Payment doc if exists
    await Payment.updateMany(
      {
        $or: [
          { transactionId: verification.transactionId },
          { gatewayReference: verification.referenceCode },
          { order: verification.order?._id },
        ],
      },
      {
        $set: {
          status: 'success',
          'metadata.approvedManuallyBy': req.user.email,
          'metadata.approvedAt': new Date(),
        },
      }
    );

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'PAYMENT_VERIFICATION_MANUALLY_APPROVED',
      entity: 'PaymentVerification',
      entityId: verification._id.toString(),
      details: {
        transactionId: verification.transactionId,
        paymentType: verification.paymentType,
        amount: verification.amount,
        orderNumber: verification.order?.orderNumber,
      },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Payment approved successfully! Associated order fulfilled or wallet credited.',
      verification,
      deliveredResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/binance/verify/:id/reject
 * Reject fraudulent or invalid payment verification submission
 */
export const rejectVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Invalid or unconfirmed transaction' } = req.body;

    const verification = await PaymentVerification.findById(id).populate('order');
    if (!verification) {
      return res.status(404).json({ success: false, message: 'Payment verification claim not found' });
    }

    if (verification.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot reject an already approved transaction' });
    }

    verification.status = 'rejected';
    verification.rejectionReason = reason;
    verification.verifiedBy = req.user._id;
    verification.verifiedAt = new Date();
    await verification.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'PAYMENT_VERIFICATION_REJECTED',
      entity: 'PaymentVerification',
      entityId: verification._id.toString(),
      details: {
        transactionId: verification.transactionId,
        reason,
      },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Payment claim rejected.',
      verification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/binance/sync
 * Poll Binance Deposit History and auto-reconcile all pending claims
 */
export const syncBinanceDeposits = async (req, res, next) => {
  try {
    const pendingClaims = await PaymentVerification.find({
      paymentType: 'binance_usdt',
      status: 'pending',
    }).populate('order');

    if (pendingClaims.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No pending Binance claims to sync.',
        matchedCount: 0,
      });
    }

    const historyRes = await fetchBinanceDepositHistory({ coin: 'USDT', status: 1, limit: 100 });
    if (!historyRes.success) {
      return res.status(400).json({
        success: false,
        message: historyRes.message || 'Failed to fetch deposits from Binance API',
      });
    }

    const deposits = historyRes.deposits || [];
    let matchedCount = 0;

    for (const claim of pendingClaims) {
      const match = deposits.find(
        (d) => d.txId && d.txId.toLowerCase().trim() === claim.transactionId.toLowerCase().trim()
      );

      if (match && parseFloat(match.amount) >= claim.amount - 0.05) {
        claim.status = 'approved';
        claim.verificationSource = 'binance_api_auto';
        claim.verifiedAt = new Date();
        claim.rawDetails = match;
        claim.adminNotes = `Reconciled via auto-sync on ${match.network} network.`;
        await claim.save();

        if (claim.order) {
          const order = await Order.findById(claim.order._id || claim.order);
          if (order && order.paymentStatus !== 'paid') {
            order.paymentStatus = 'paid';
            order.paymentDetails = {
              transactionId: match.txId,
              gateway: 'binance',
              paidAt: new Date(),
            };
            await order.save();
            const customer = await User.findById(order.user);
            await processOrderKeyDelivery(order, customer);
          }
        }

        matchedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Sync completed: Auto-reconciled ${matchedCount} of ${pendingClaims.length} pending deposits.`,
      matchedCount,
      pendingRemaining: pendingClaims.length - matchedCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/binance/config
 * Retrieve Binance and UPI gateway settings for administration
 */
export const getBinanceConfig = async (req, res, next) => {
  try {
    let settings = await WebsiteSetting.findOne();
    if (!settings) {
      settings = await WebsiteSetting.create({});
    }

    const binance = settings.gateways?.binance || {};
    const upi = settings.gateways?.upi || {};

    let apiKeyMasked = '';
    let hasApiKey = false;
    let hasApiSecret = false;

    if (binance.apiKey) {
      hasApiKey = true;
      try {
        const decryptedKey = decryptCredential(binance.apiKey);
        apiKeyMasked = decryptedKey.length > 8
          ? `${decryptedKey.slice(0, 4)}••••••••${decryptedKey.slice(-4)}`
          : '••••••••';
      } catch (e) {
        apiKeyMasked = '••••••••';
      }
    }

    if (binance.apiSecret) {
      hasApiSecret = true;
    }

    res.status(200).json({
      success: true,
      config: {
        enabled: binance.enabled !== false,
        apiKey: apiKeyMasked,
        apiKeyMasked,
        hasApiKey,
        hasApiSecret,
        depositAddress: binance.depositAddress || 'TLR7Vw3G1uK4K4U5w6q7N9x8yZ2A1B3C4D',
        network: binance.network || 'TRX',
        autoVerifyEnabled: binance.autoVerifyEnabled !== false,
        usdtToUsdRate: binance.usdtToUsdRate || 1.0,
        usdtToInrRate: binance.usdtToInrRate || 86.5,
        minDepositUsdt: binance.minDepositUsdt || 1,
        upi: {
          enabled: upi.enabled !== false,
          upiId: upi.upiId || upi.vpa || 'bundlebyte@icici',
          merchantName: upi.merchantName || 'BundleByte Technologies Inc.',
          autoApproveTrusted: upi.autoApproveTrusted !== false,
          qrCodeUrl: upi.qrCodeUrl || '',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/binance/config
 * Update Binance credentials with encryption at rest and settings
 */
export const updateBinanceConfig = async (req, res, next) => {
  try {
    const {
      enabled,
      apiKey,
      apiSecret,
      depositAddress,
      network = 'TRX',
      autoVerifyEnabled = true,
      usdtToUsdRate = 1.0,
      usdtToInrRate = 86.5,
      upi,
    } = req.body;

    let settings = await WebsiteSetting.findOne();
    if (!settings) {
      settings = await WebsiteSetting.create({});
    }

    if (!settings.gateways) {
      settings.gateways = {};
    }
    if (!settings.gateways.binance) {
      settings.gateways.binance = {};
    }

    const currentBinance = settings.gateways.binance;

    // Handle apiKey update
    if (apiKey !== undefined) {
      if (apiKey && !apiKey.includes('••••')) {
        currentBinance.apiKey = encryptCredential(apiKey.trim());
      }
    }

    // Handle apiSecret update (encrypt with AES-256-GCM)
    if (apiSecret !== undefined) {
      if (apiSecret && !apiSecret.includes('••••')) {
        currentBinance.apiSecret = encryptCredential(apiSecret.trim());
      }
    }

    if (enabled !== undefined) currentBinance.enabled = enabled;
    if (depositAddress !== undefined) currentBinance.depositAddress = depositAddress.trim();
    if (network !== undefined) currentBinance.network = network.trim();
    if (autoVerifyEnabled !== undefined) currentBinance.autoVerifyEnabled = autoVerifyEnabled;
    if (usdtToUsdRate !== undefined) currentBinance.usdtToUsdRate = Number(usdtToUsdRate);
    if (usdtToInrRate !== undefined) currentBinance.usdtToInrRate = Number(usdtToInrRate);

    // Handle UPI config if provided
    if (upi) {
      if (!settings.gateways.upi) settings.gateways.upi = {};
      if (upi.enabled !== undefined) settings.gateways.upi.enabled = upi.enabled;
      if (upi.upiId !== undefined) {
        settings.gateways.upi.upiId = upi.upiId.trim();
        settings.gateways.upi.vpa = upi.upiId.trim();
      }
      if (upi.merchantName !== undefined) settings.gateways.upi.merchantName = upi.merchantName.trim();
      if (upi.autoApproveTrusted !== undefined) settings.gateways.upi.autoApproveTrusted = upi.autoApproveTrusted;
    }

    settings.markModified('gateways');
    await settings.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'BINANCE_GATEWAY_CONFIG_UPDATED',
      entity: 'WebsiteSetting',
      details: {
        enabled: currentBinance.enabled,
        network: currentBinance.network,
        hasApiKey: !!currentBinance.apiKey,
        hasApiSecret: !!currentBinance.apiSecret,
      },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Binance and UPI payment gateway configuration saved securely (credentials encrypted at rest).',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/binance/seed-trusted-utr
 * Helper for admin to record incoming bank settlements for automated UTR verification testing
 */
export const seedTrustedBankRecord = async (req, res, next) => {
  try {
    const { transactionId, amount, currency = 'INR', senderName = 'Customer Transfer' } = req.body;

    if (!transactionId || !amount) {
      return res.status(400).json({ success: false, message: 'Transaction ID / UTR and amount are required' });
    }

    const record = await TrustedPaymentRecord.create({
      paymentType: 'upi_utr',
      transactionId: transactionId.trim(),
      amount: Number(amount),
      currency,
      senderName,
      status: 'credited',
    });

    res.status(201).json({
      success: true,
      message: 'Trusted bank settlement record registered for automated UTR matching.',
      record,
    });
  } catch (error) {
    next(error);
  }
};

