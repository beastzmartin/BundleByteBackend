import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import PaymentVerification from '../models/PaymentVerification.js';
import { getPaymentGateway } from '../services/payment/index.js';
import { binanceGateway } from '../services/payment/binanceGateway.js';
import { upiGateway } from '../services/payment/upiGateway.js';
import { processOrderKeyDelivery } from '../services/keyDeliveryEngine.js';
import { creditWallet } from '../services/walletService.js';
import { logAudit } from '../middleware/audit.js';

export const verifyPayment = async (req, res, next) => {
  try {
    const { transactionId, orderId, gateway: gatewayName = 'binance', token } = req.body;

    if (gatewayName === 'mock') {
      return res.status(400).json({
        success: false,
        message: 'Mock test payments are disabled in production.',
      });
    }

    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Transaction ID is required' });
    }

    const gateway = getPaymentGateway(gatewayName);
    const verification = await gateway.verifyPayment({
      transactionId,
      paymentToken: token,
    });

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        message: verification.message || 'Payment verification failed server-side',
      });
    }

    // Locate order
    const order = await Order.findById(orderId || verification.payment?.order);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Associated order not found' });
    }

    const customerUser = await User.findById(order.user);

    // If order was already paid, return early to prevent double-fulfillment
    if (order.paymentStatus === 'paid' && order.deliveryStatus === 'delivered') {
      return res.status(200).json({
        success: true,
        message: 'Payment already processed and delivered',
        order,
      });
    }

    // Mark paid
    order.paymentStatus = 'paid';
    order.paymentDetails = {
      transactionId,
      gateway: gatewayName,
      paidAt: new Date(),
    };
    await order.save();

    // Process automated digital key delivery / manual queuing!
    const deliveredResult = await processOrderKeyDelivery(order, customerUser);
    const deliveredItems = deliveredResult?.deliveryResults || [];

    await logAudit({
      actor: customerUser?._id,
      actorEmail: customerUser?.email,
      actorRole: customerUser?.role,
      action: 'PAYMENT_VERIFIED_AND_FULFILLED',
      entity: 'Order',
      entityId: order._id.toString(),
      details: { transactionId, gateway: gatewayName, totalAmount: order.totalAmount },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified and digital products delivered successfully!',
      order: deliveredResult?.order || order,
      deliveredItems,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer submits Binance / Blockchain TxID for Order or Wallet Top-Up
 */
export const submitBinanceTxId = async (req, res, next) => {
  try {
    const { orderId, txId, isWalletTopup, amount } = req.body;
    const candidateTx = txId || req.body.transactionId;

    if (!candidateTx || typeof candidateTx !== 'string' || candidateTx.trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid blockchain Transaction Hash / TxID (minimum 8 characters).',
      });
    }

    const cleanTxId = candidateTx.trim();

    if (isWalletTopup) {
      let topupAmount = parseFloat(amount);
      const custCur = (req.body.currency || 'USDT').toUpperCase();
      const rawCustomerAmount = req.body.customerAmount ? parseFloat(req.body.customerAmount) : null;

      const exchangeRateService = (await import('../services/currency/exchangeRateService.js')).default;
      const rateInfo = await exchangeRateService.getExchangeRate('INR', 'USD');
      const rateInverse = rateInfo.rateInverse || 88.50;

      // If client sent customerAmount in a foreign currency (e.g. EUR, GBP), compute required USDT or base INR safely
      if (isNaN(topupAmount) || topupAmount <= 0) {
        if (rawCustomerAmount && !isNaN(rawCustomerAmount) && rawCustomerAmount > 0) {
          const custRateInfo = await exchangeRateService.getExchangeRate('INR', custCur);
          const custRateInverse = custRateInfo.rateInverse || 88.50;
          const baseINR = rawCustomerAmount * custRateInverse;
          topupAmount = +(baseINR * (rateInfo.effectiveRate || 0.0113)).toFixed(2);
        } else {
          return res.status(400).json({ success: false, message: 'Invalid wallet top-up amount' });
        }
      }

      const paise = Math.round(topupAmount * rateInverse * 100);

      const verification = await binanceGateway.verifyPayment({
        txId: cleanTxId,
        expectedAmount: topupAmount,
        userId: req.user._id,
        isWalletTopup: true,
        walletAmountPaise: paise,
      });

      if (verification.verified) {
        // Credit wallet in integer paise
        await creditWallet({
          userId: req.user._id,
          amountPaise: paise,
          type: 'topup',
          description: `Binance USDT Top-Up verified via TxID: ${cleanTxId} (${topupAmount} USDT @ ₹${rateInverse.toFixed(2)}${rawCustomerAmount ? ` for ${rawCustomerAmount} ${custCur}` : ''})`,
          metadata: {
            txId: cleanTxId,
            gateway: 'binance',
            originalAmount: rawCustomerAmount || topupAmount,
            originalCurrency: custCur,
            usdtAmount: topupAmount,
            appliedExchangeRate: rateInverse,
          },
        });

        return res.status(200).json({
          success: true,
          verified: true,
          message: `Binance USDT deposit verified! Credited ₹${(paise / 100).toFixed(2)} to your wallet.`,
        });
      } else {
        return res.status(200).json({
          success: true,
          verified: false,
          pendingReview: true,
          claimId: verification.claimId,
          message: verification.message || 'Deposit TxID submitted for manual reconciliation.',
        });
      }
    }

    // Order purchase flow
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized for this order' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        verified: true,
        message: 'Order is already marked as paid.',
        order,
      });
    }

    const verification = await binanceGateway.verifyPayment({
      txId: cleanTxId,
      expectedAmount: order.totalAmount,
      orderId: order._id,
      userId: req.user._id,
    });

    if (verification.verified) {
      order.paymentStatus = 'paid';
      order.paymentDetails = {
        transactionId: cleanTxId,
        gateway: 'binance',
        paidAt: new Date(),
      };
      await order.save();

      const deliveredResult = await processOrderKeyDelivery(order, req.user);

      return res.status(200).json({
        success: true,
        verified: true,
        verification: { status: 'approved' },
        message: 'Binance deposit verified successfully! Order fulfilled.',
        order: deliveredResult?.order || order,
      });
    } else {
      return res.status(200).json({
        success: true,
        verified: false,
        pendingReview: true,
        verification: { status: 'pending' },
        claimId: verification.claimId,
        message: verification.message || 'TxID submitted. Will be verified automatically once confirmed.',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Customer submits UPI UTR for Order or Wallet Top-Up
 */
export const submitUpiUtr = async (req, res, next) => {
  try {
    const { orderId, utrNumber, isWalletTopup, amount } = req.body;
    const candidateUtr = utrNumber || req.body.utr || req.body.transactionId;

    if (!candidateUtr || typeof candidateUtr !== 'string' || candidateUtr.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 12-digit UPI UTR / Transaction Reference Number.',
      });
    }

    const cleanUtr = candidateUtr.trim();

    if (isWalletTopup) {
      let topupAmount = parseFloat(amount);
      const custCur = (req.body.currency || 'INR').toUpperCase();
      const rawCustomerAmount = req.body.customerAmount ? parseFloat(req.body.customerAmount) : null;
      let rateInverse = 1.0;

      if (custCur !== 'INR') {
        const exchangeRateService = (await import('../services/currency/exchangeRateService.js')).default;
        const rateInfo = await exchangeRateService.getExchangeRate('INR', custCur);
        rateInverse = rateInfo.rateInverse || 88.50;
        if (rawCustomerAmount && !isNaN(rawCustomerAmount) && rawCustomerAmount > 0) {
          topupAmount = Number((rawCustomerAmount * rateInverse).toFixed(2));
        }
      }

      if (isNaN(topupAmount) || topupAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid wallet top-up amount' });
      }

      const paise = Math.round(topupAmount * 100);

      const verification = await upiGateway.verifyPayment({
        utrNumber: cleanUtr,
        expectedAmount: topupAmount,
        userId: req.user._id,
        isWalletTopup: true,
        walletAmountPaise: paise,
      });

      if (verification.verified) {
        await creditWallet({
          userId: req.user._id,
          amountPaise: paise,
          type: 'topup',
          description: `UPI Top-Up verified via UTR: ${cleanUtr} (${rawCustomerAmount ? `${rawCustomerAmount} ${custCur} @ ₹${rateInverse.toFixed(2)}` : `₹${topupAmount.toFixed(2)}`})`,
          metadata: {
            utrNumber: cleanUtr,
            gateway: 'upi',
            originalAmount: rawCustomerAmount || topupAmount,
            originalCurrency: custCur,
            appliedExchangeRate: rateInverse,
          },
        });

        return res.status(200).json({
          success: true,
          verified: true,
          message: `UPI payment verified against banking records! Credited ₹${(paise / 100).toFixed(2)} to your wallet.`,
        });
      } else {
        return res.status(200).json({
          success: true,
          verified: false,
          pendingReview: true,
          claimId: verification.claimId,
          message: verification.message || 'UTR recorded. Our accounts desk will verify your payment.',
        });
      }
    }

    // Order purchase flow
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized for this order' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        verified: true,
        message: 'Order is already marked as paid.',
        order,
      });
    }

    const verification = await upiGateway.verifyPayment({
      utrNumber: cleanUtr,
      expectedAmount: order.totalAmount,
      orderId: order._id,
      userId: req.user._id,
    });

    if (verification.verified) {
      order.paymentStatus = 'paid';
      order.paymentDetails = {
        transactionId: cleanUtr,
        gateway: 'upi',
        paidAt: new Date(),
      };
      await order.save();

      const deliveredResult = await processOrderKeyDelivery(order, req.user);

      return res.status(200).json({
        success: true,
        verified: true,
        verification: { status: 'approved' },
        message: 'UPI payment verified against banking records! Order fulfilled.',
        order: deliveredResult?.order || order,
      });
    } else {
      return res.status(200).json({
        success: true,
        verified: false,
        pendingReview: true,
        verification: { status: 'pending' },
        claimId: verification.claimId,
        message: verification.message || 'UTR submitted for manual bank statement verification.',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Check payment status of an order for live polling
 */
export const getOrderPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).select('orderNumber paymentStatus deliveryStatus paymentDetails totalAmount currency');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const verification = await PaymentVerification.findOne({ order: order._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      deliveryStatus: order.deliveryStatus,
      paymentDetails: order.paymentDetails,
      verification: verification
        ? {
            status: verification.status,
            transactionId: verification.transactionId,
            verificationSource: verification.verificationSource,
            createdAt: verification.createdAt,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

export const handleWebhook = async (req, res, next) => {
  try {
    const { gateway = 'mock' } = req.params;
    const event = req.body;

    console.log(`📡 Inbound webhook received for gateway: ${gateway}`, event);

    // For mock / stripe / paypal webhooks:
    if (gateway === 'mock' || gateway === 'stripe') {
      const transactionId = event.transactionId || event.data?.object?.id;
      if (transactionId) {
        const payment = await Payment.findOne({ transactionId });
        if (payment && payment.status !== 'success') {
          payment.status = 'success';
          payment.webhookEvents.push({
            eventName: 'webhook.processed',
            receivedAt: new Date(),
            payload: event,
          });
          await payment.save();

          const order = await Order.findById(payment.order);
          if (order && order.paymentStatus !== 'paid') {
            order.paymentStatus = 'paid';
            await order.save();
            const user = await User.findById(order.user);
            await processOrderKeyDelivery(order, user);
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const total = await Payment.countDocuments();
    const payments = await Payment.find()
      .populate('user', 'name email')
      .populate('order', 'orderNumber totalAmount paymentStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      payments,
    });
  } catch (error) {
    next(error);
  }
};

