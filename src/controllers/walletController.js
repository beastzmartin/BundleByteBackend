import crypto from 'crypto';
import Order from '../models/Order.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import PaymentVerification from '../models/PaymentVerification.js';
import {
  getOrCreateWallet,
  creditWallet,
  debitWallet,
  reconcileWallet,
} from '../services/walletService.js';
import { processOrderKeyDelivery } from '../services/keyDeliveryEngine.js';
import { getPaymentGateway } from '../services/payment/index.js';
import { logAudit } from '../middleware/audit.js';
import { sendWalletTopupEmail } from '../services/emailService.js';

/**
 * GET /api/wallet
 * Retrieve logged-in customer's wallet information & recent ledger
 */
export const getWallet = async (req, res, next) => {
  try {
    const wallet = await getOrCreateWallet(req.user._id);
    const recentTransactions = await WalletTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('relatedOrder', 'orderNumber totalAmount paymentStatus');

    const baseCurrency = wallet.currency || 'INR';
    let displayCurrency = (req.query.currency || baseCurrency).toUpperCase();
    let convertedBalance = +(wallet.balance / 100).toFixed(2);
    let exchangeRate = 1.0;

    if (displayCurrency !== baseCurrency) {
      try {
        const exchangeRateService = (await import('../services/currency/exchangeRateService.js')).default;
        const rateInfo = await exchangeRateService.getExchangeRate(baseCurrency, displayCurrency);
        convertedBalance = Number(((wallet.balance / 100) * rateInfo.effectiveRate).toFixed(2));
        exchangeRate = rateInfo.effectiveRate;
      } catch (e) {
        displayCurrency = baseCurrency;
      }
    }

    res.status(200).json({
      success: true,
      wallet: {
        _id: wallet._id,
        balancePaise: wallet.balance,
        balanceRupees: +(wallet.balance / 100).toFixed(2),
        totalAddedPaise: wallet.totalAdded,
        totalAddedRupees: +(wallet.totalAdded / 100).toFixed(2),
        totalSpentPaise: wallet.totalSpent,
        totalSpentRupees: +(wallet.totalSpent / 100).toFixed(2),
        totalCashbackPaise: wallet.totalCashback,
        totalCashbackRupees: +(wallet.totalCashback / 100).toFixed(2),
        currency: baseCurrency,
        displayCurrency,
        convertedBalance,
        exchangeRate,
        isActive: wallet.isActive,
      },
      recentTransactions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/wallet/balance
 * Fast lookup for current available wallet balance
 */
export const getWalletBalance = async (req, res, next) => {
  try {
    const wallet = await getOrCreateWallet(req.user._id);
    res.status(200).json({
      success: true,
      balancePaise: wallet.balance,
      balanceRupees: +(wallet.balance / 100).toFixed(2),
      currency: wallet.currency || 'INR',
      isActive: wallet.isActive,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/wallet/transactions
 * Retrieve paginated transaction ledger
 */
export const getWalletTransactions = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 15 } = req.query;
    const query = { user: req.user._id };

    if (type && type !== 'all') {
      query.type = type;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('relatedOrder', 'orderNumber totalAmount items'),
      WalletTransaction.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      transactions,
      pagination: {
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
 * POST /api/wallet/topup
 * Initiate top-up session with payment gateway
 */
export const initiateTopup = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', gateway: gatewayName = 'upi' } = req.body;

    if (gatewayName === 'mock') {
      return res.status(400).json({
        success: false,
        message: 'Mock test wallet top-up is disabled in production.',
      });
    }

    const rawAmount = parseFloat(amount);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid top-up amount.',
      });
    }

    const exchangeRateService = (await import('../services/currency/exchangeRateService.js')).default;
    const custCur = currency.toUpperCase();
    let baseAmountINR = rawAmount;
    let rateInverse = 1.0;
    let rateInfo = null;

    if (custCur !== 'INR') {
      rateInfo = await exchangeRateService.getExchangeRate('INR', custCur);
      rateInverse = rateInfo.rateInverse || 88.50;
      baseAmountINR = Number((rawAmount * rateInverse).toFixed(2));
    }

    if (baseAmountINR < 10) {
      return res.status(400).json({
        success: false,
        message: `Minimum wallet top-up is ₹10.00 (${custCur !== 'INR' ? `approx ${(10 / rateInverse).toFixed(2)} ${custCur}` : ''})`,
      });
    }

    if (baseAmountINR > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum single top-up amount is ₹100,000.00',
      });
    }

    let processingAmount = baseAmountINR;
    let processingCurrency = 'INR';

    if (gatewayName === 'binance') {
      processingCurrency = 'USDT';
      const usdRate = await exchangeRateService.getExchangeRate('INR', 'USD');
      processingAmount = Number((baseAmountINR * usdRate.effectiveRate).toFixed(2));
    }

    const gateway = getPaymentGateway(gatewayName);
    const referenceId = `TOPUP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const session = await gateway.createPaymentSession({
      amount: processingAmount,
      currency: processingCurrency,
      orderId: referenceId,
      user: req.user,
      customerEmail: req.user.email,
      customerName: req.user.name,
      metadata: {
        type: 'wallet_topup',
        userId: req.user._id.toString(),
        baseAmountINR,
        customerAmount: rawAmount,
        customerCurrency: custCur,
        exchangeRate: rateInfo ? rateInfo.effectiveRate : 1.0,
      },
    });

    res.status(200).json({
      success: true,
      referenceId,
      baseAmountINR,
      processingAmount,
      processingCurrency,
      customerAmount: rawAmount,
      customerCurrency: custCur,
      session,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/wallet/verify-topup
 * Server-side verification and wallet credit
 */
export const verifyTopup = async (req, res, next) => {
  try {
    const { transactionId, amount, gateway: gatewayName = 'upi', token, txId, utr, network } = req.body;

    if (gatewayName === 'mock') {
      return res.status(400).json({
        success: false,
        message: 'Mock payment verification is disabled in production.',
      });
    }

    const effectiveTxId = txId || utr || transactionId;

    if (!effectiveTxId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required for verification',
      });
    }

    // Check for duplicate credit with same transactionId in metadata
    const duplicate = await WalletTransaction.findOne({
      user: req.user._id,
      'metadata.gatewayTransactionId': effectiveTxId,
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'This top-up transaction has already been credited to your wallet.',
      });
    }

    // Check if this transaction has already been approved in PaymentVerification
    const existingPv = await PaymentVerification.findOne({
      transactionId: effectiveTxId,
    });
    if (existingPv && existingPv.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'This transaction reference has already been verified and utilized.',
      });
    }

    const exchangeRateService = (await import('../services/currency/exchangeRateService.js')).default;
    const rawAmount = parseFloat(amount);

    const gateway = getPaymentGateway(gatewayName);
    const verification = await gateway.verifyPayment({
      transactionId: effectiveTxId,
      orderId: transactionId,
      paymentToken: token,
      txId: txId || transactionId,
      utr: utr || transactionId,
      network,
      amount: rawAmount,
    });

    if (!verification.verified) {
      // If payment is Binance or UPI and not auto-verified, record a pending verification claim for admin review
      if (gatewayName === 'binance' || gatewayName === 'upi') {
        let expectedPaise = Math.round(rawAmount * 100);
        if (gatewayName === 'binance') {
          const rateInfo = await exchangeRateService.getExchangeRate('INR', 'USD');
          expectedPaise = Math.round(rawAmount * (rateInfo.rateInverse || 88.50) * 100);
        }

        const pv = await PaymentVerification.create({
          order: null,
          user: req.user._id,
          paymentType: gatewayName === 'binance' ? 'binance_usdt' : 'upi_utr',
          referenceCode: transactionId || `TOPUP-${Date.now()}`,
          transactionId: effectiveTxId,
          amount: rawAmount,
          currency: gatewayName === 'binance' ? 'USDT' : 'INR',
          status: 'pending',
          verificationSource: 'admin_manual',
          isWalletTopup: true,
          walletAmountPaise: expectedPaise,
          adminNotes: `Customer top-up submission via ${gatewayName}. Expected wallet credit: ₹${(expectedPaise / 100).toFixed(2)}.`,
          rawDetails: {
            ...verification,
            network,
            submittedAt: new Date(),
          },
        });

        return res.status(200).json({
          success: true,
          pending: true,
          message:
            gatewayName === 'binance'
              ? 'Binance transaction hash submitted! Your deposit is queued for automated API sync & admin reconciliation.'
              : 'UPI UTR submitted! Your 12-digit reference has been submitted to the verification ledger and is awaiting reconciliation.',
          verificationId: pv._id,
        });
      }

      return res.status(400).json({
        success: false,
        message: verification.message || 'Payment verification failed server-side',
      });
    }

    const verifiedAmount = verification.amount || rawAmount;
    if (!verifiedAmount || verifiedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verified payment amount',
      });
    }

    let verifiedAmountINR = verifiedAmount;
    let rateInverse = 1.0;

    if (gatewayName === 'binance') {
      const rateInfo = await exchangeRateService.getExchangeRate('INR', 'USD');
      rateInverse = rateInfo.rateInverse || 88.50;
      verifiedAmountINR = Number((verifiedAmount * rateInverse).toFixed(2));
    }

    const amountPaise = Math.round(verifiedAmountINR * 100);

    // Record verified payment claim
    await PaymentVerification.create({
      order: null,
      user: req.user._id,
      paymentType: gatewayName === 'binance' ? 'binance_usdt' : 'upi_utr',
      referenceCode: transactionId || `TOPUP-${Date.now()}`,
      transactionId: effectiveTxId,
      amount: verifiedAmount,
      currency: gatewayName === 'binance' ? 'USDT' : 'INR',
      status: 'approved',
      verificationSource:
        verification.verificationSource ||
        (gatewayName === 'binance' ? 'binance_api_auto' : 'trusted_ledger_auto'),
      verifiedAt: new Date(),
      isWalletTopup: true,
      walletAmountPaise: amountPaise,
      rawDetails: verification,
    });

    // Credit wallet with immutable ledger entry
    const { wallet, transaction } = await creditWallet({
      userId: req.user._id,
      amountPaise,
      type: 'topup',
      description: `Wallet top-up via ${gatewayName.toUpperCase()} (${effectiveTxId}) ${
        gatewayName === 'binance' ? `[${verifiedAmount} USDT @ ₹${rateInverse.toFixed(2)}]` : ''
      }`,
      metadata: {
        gateway: gatewayName,
        gatewayTransactionId: effectiveTxId,
        originalAmount: verifiedAmount,
        originalCurrency: gatewayName === 'binance' ? 'USDT' : 'INR',
        appliedExchangeRate: rateInverse,
      },
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'WALLET_TOPUP_CREDITED',
      entity: 'Wallet',
      entityId: wallet._id.toString(),
      details: { amountPaise, transactionId: effectiveTxId, newBalancePaise: wallet.balance },
      req,
    });

    // Send automated email notification for wallet top-up
    sendWalletTopupEmail(req.user, verifiedAmountINR, +(wallet.balance / 100).toFixed(2)).catch((err) =>
      console.error('[WalletController] Topup email failed:', err.message)
    );

    res.status(200).json({
      success: true,
      message: `Successfully added ₹${(amountPaise / 100).toFixed(2)} to your wallet!`,
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
 * POST /api/wallet/pay
 * Pay for an order using Wallet Balance or Split Payment (Wallet + Online Gateway)
 */
export const payWithWallet = async (req, res, next) => {
  try {
    const {
      orderId,
      walletAmountUsed, // in INR (optional; if not provided or equals total, full wallet pay)
      isSplit = false,
      gateway: gatewayName = 'mock',
      gatewayTransactionId,
      gatewayToken,
    } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }

    const orderTotalPaise = Math.round((order.baseAmount || order.totalAmount) * 100);
    const requiredBaseRupees = +(orderTotalPaise / 100).toFixed(2);
    const wallet = await getOrCreateWallet(req.user._id);

    if (!wallet.isActive) {
      return res.status(400).json({ success: false, message: 'Your wallet is currently inactive or suspended' });
    }

    let walletDebitPaise = 0;
    let gatewayPayAmount = 0;

    if (!isSplit) {
      // Full Wallet Payment
      walletDebitPaise = orderTotalPaise;

      if (wallet.balance < walletDebitPaise) {
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. Required: ₹${requiredBaseRupees.toFixed(2)}, Available: ₹${(
            wallet.balance / 100
          ).toFixed(2)}`,
        });
      }

      // Debit wallet atomically
      await debitWallet({
        userId: req.user._id,
        amountPaise: walletDebitPaise,
        type: 'purchase',
        description: `Full payment for Order #${order.orderNumber}`,
        relatedOrder: order._id,
        metadata: { orderNumber: order.orderNumber, fullPayment: true },
      });

      order.paymentMethod = 'wallet';
      order.walletAmountUsed = requiredBaseRupees;
      order.walletAmountPaise = walletDebitPaise;
      order.gatewayAmountPaid = 0;
      order.paymentStatus = 'paid';
      order.paymentDetails = {
        transactionId: `WAL-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        gateway: 'wallet',
        paidAt: new Date(),
      };
    } else {
      // Split Payment: Wallet + Online Gateway
      const requestedWalletINR = parseFloat(walletAmountUsed);
      if (isNaN(requestedWalletINR) || requestedWalletINR <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid split wallet amount' });
      }

      walletDebitPaise = Math.round(requestedWalletINR * 100);

      if (walletDebitPaise >= orderTotalPaise) {
        return res.status(400).json({
          success: false,
          message: 'Wallet amount covers the full order. Please select Full Wallet Payment.',
        });
      }

      if (wallet.balance < walletDebitPaise) {
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance for split payment. Available: ₹${(
            wallet.balance / 100
          ).toFixed(2)}`,
        });
      }

      const remainingPaise = orderTotalPaise - walletDebitPaise;
      gatewayPayAmount = +(remainingPaise / 100).toFixed(2);

      // Verify online payment portion
      if (!gatewayTransactionId) {
        return res.status(400).json({
          success: false,
          message: 'Gateway transaction ID is required for split payment remaining balance',
        });
      }

      const gateway = getPaymentGateway(gatewayName);
      const verification = await gateway.verifyPayment({
        transactionId: gatewayTransactionId,
        paymentToken: gatewayToken,
      });

      if (!verification.verified) {
        return res.status(400).json({
          success: false,
          message: verification.message || 'Online payment verification failed for split payment',
        });
      }

      // Debit wallet portion
      await debitWallet({
        userId: req.user._id,
        amountPaise: walletDebitPaise,
        type: 'purchase',
        description: `Split payment (₹${requestedWalletINR.toFixed(2)} Wallet + ₹${gatewayPayAmount.toFixed(
          2
        )} Gateway) for Order #${order.orderNumber}`,
        relatedOrder: order._id,
        metadata: {
          orderNumber: order.orderNumber,
          split: true,
          gateway: gatewayName,
          gatewayTransactionId,
        },
      });

      // Record or update payment
      await Payment.findOneAndUpdate(
        { transactionId: gatewayTransactionId },
        {
          $set: {
            order: order._id,
            user: req.user._id,
            amount: gatewayPayAmount,
            currency: order.currency || 'INR',
            gateway: 'wallet_split',
            status: 'success',
            gatewayReference: `SPLIT-${order.orderNumber}`,
          },
        },
        { upsert: true, new: true }
      );

      order.paymentMethod = 'wallet_split';
      order.walletAmountUsed = requestedWalletINR;
      order.walletAmountPaise = walletDebitPaise;
      order.gatewayAmountPaid = gatewayPayAmount;
      order.paymentStatus = 'paid';
      order.paymentDetails = {
        transactionId: gatewayTransactionId,
        gateway: gatewayName,
        paidAt: new Date(),
      };
    }

    await order.save();

    // Process digital key delivery (automatic allocation or manual queue routing)
    const userDoc = await User.findById(req.user._id);
    const deliveryResult = await processOrderKeyDelivery(order, userDoc);

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: isSplit ? 'ORDER_PAID_SPLIT_WALLET' : 'ORDER_PAID_WALLET',
      entity: 'Order',
      entityId: order._id.toString(),
      details: {
        totalAmount: order.totalAmount,
        walletDebitPaise,
        gatewayPayAmount,
        deliveryStatus: order.deliveryStatus,
      },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Order paid successfully using your wallet!',
      order,
      deliveryResult,
    });
  } catch (error) {
    next(error);
  }
};
