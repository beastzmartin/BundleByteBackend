import crypto from 'crypto';
import Order from '../models/Order.js';
import User from '../models/User.js';
import PaymentAttempt from '../models/PaymentAttempt.js';
import PaytmMerchant from '../models/PaytmMerchant.js';
import PaymentVerificationLog from '../models/PaymentVerificationLog.js';
import {
  generateUpiPaymentUri,
  generatePaytmIntentDeepLink,
  generateQrCodeUrl,
  queryPaytmOrderStatus,
  verifyPaytmSignature,
} from '../services/payment/paytmService.js';
import { selectMerchantForPayment } from '../services/payment/paytmRoutingEngine.js';
import { fulfillSuccessfulPaytmPayment } from '../services/payment/paytmCronService.js';

/**
 * Initiate dynamic Paytm QR payment session
 * POST /api/payments/paytm/initiate
 */
export const initiatePayment = async (req, res, next) => {
  try {
    const { orderId, isWalletTopup, amount: requestedAmount } = req.body;

    let targetOrder = null;
    let paymentAmount = 0;
    let orderNumberDisplay = '';

    if (isWalletTopup) {
      const custCur = (req.body.currency || 'INR').toUpperCase();
      const rawAmt = parseFloat(requestedAmount);
      if (isNaN(rawAmt) || rawAmt <= 0) {
        return res.status(400).json({ success: false, message: 'Please provide a valid wallet top-up amount' });
      }

      if (custCur !== 'INR') {
        const exchangeRateService = (await import('../services/currency/exchangeRateService.js')).default;
        const rateInfo = await exchangeRateService.getExchangeRate('INR', custCur);
        paymentAmount = Number((rawAmt * (rateInfo.rateInverse || 88.50)).toFixed(2));
      } else {
        paymentAmount = rawAmt;
      }

      orderNumberDisplay = `TOPUP-${Date.now().toString().slice(-6)}`;
    } else {
      if (!orderId) {
        return res.status(400).json({ success: false, message: 'Order ID is required to initiate payment' });
      }

      targetOrder = await Order.findById(orderId);
      if (!targetOrder) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (targetOrder.paymentStatus === 'paid') {
        return res.status(400).json({ success: false, message: 'Order has already been paid and verified' });
      }

      // Exact processing amount from locked quote/base accounting
      paymentAmount = targetOrder.processingAmount || targetOrder.baseAmount || targetOrder.totalAmount;
      orderNumberDisplay = targetOrder.orderNumber;
    }

    // Select eligible merchant via Multi-Merchant Routing Engine
    const selectedMerchant = await selectMerchantForPayment({ amount: paymentAmount });

    // Generate unique Paytm transaction references matching reference implementation
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const merchantOrderId = `PTM-${Date.now()}-${randomSuffix}`;
    const paytmTxnRef = `REF${Date.now()}${randomSuffix}`;
    const paytmRemark = `TXN${Math.floor(100 + Math.random() * 900)}${Date.now()}${Math.floor(1 + Math.random() * 100)}`;

    // Generate Dynamic UPI URI & Paytm deep link
    const upiUri = generateUpiPaymentUri({
      upiId: selectedMerchant.upiId,
      merchantName: selectedMerchant.merchantName,
      amount: paymentAmount,
      txnRef: paytmTxnRef,
      remark: paytmRemark,
    });

    const paytmIntentUri = generatePaytmIntentDeepLink({
      upiId: selectedMerchant.upiId,
      merchantName: selectedMerchant.merchantName,
      amount: paymentAmount,
      txnRef: paytmTxnRef,
      remark: paytmRemark,
    });

    const qrCodeUrl = generateQrCodeUrl(upiUri);

    // Expiration: 10 minutes from now (generous 600s window to avoid premature timeout)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Atomically persist PaymentAttempt locking the merchant to this transaction
    const paymentAttempt = await PaymentAttempt.create({
      order: targetOrder ? targetOrder._id : null,
      user: req.user._id,
      merchant: selectedMerchant._id,
      merchantName: selectedMerchant.merchantName,
      paytmMid: selectedMerchant.mid,
      merchantOrderId,
      paytmTxnRef,
      paytmRemark,
      amount: paymentAmount,
      currency: 'INR',
      upiUri,
      paytmIntentUri,
      qrCodeUrl,
      status: 'PENDING',
      expiresAt,
      isWalletTopup: !!isWalletTopup,
      walletTopupRef: isWalletTopup ? orderNumberDisplay : '',
    });

    res.status(200).json({
      success: true,
      payment: {
        paymentId: paymentAttempt._id,
        orderId: targetOrder?._id || null,
        orderNumber: orderNumberDisplay,
        merchantOrderId,
        merchantName: selectedMerchant.merchantName,
        mid: selectedMerchant.mid,
        amount: paymentAmount,
        currency: 'INR',
        upiUri,
        paytmIntentUri,
        qrCodeUrl,
        expiresAt,
        countdownSeconds: 600,
        status: 'PENDING',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Real-time payment verification polling
 * GET /api/payments/paytm/status/:paymentId
 */
export const checkPaymentStatus = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const attempt = await PaymentAttempt.findById(paymentId).populate('merchant');
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Payment attempt session not found' });
    }

    // 1. If already verified as successful, return immediately (Idempotent!)
    if (attempt.status === 'TXN_SUCCESS') {
      return res.status(200).json({
        success: true,
        status: 'SUCCESS',
        isPaid: true,
        transactionId: attempt.paytmTxnId,
        bankTxnId: attempt.bankTxnId,
        orderId: attempt.order,
        message: 'Payment received and verified successfully!',
      });
    }

    // 2. If already cancelled
    if (attempt.status === 'CANCELLED') {
      return res.status(200).json({
        success: true,
        status: attempt.status,
        isPaid: false,
        message: 'Payment was cancelled by user',
      });
    }

    // 3. Check expiration
    const now = new Date();
    if (attempt.expiresAt && new Date(attempt.expiresAt) < now) {
      // Check live status one last time
      const merchant = await PaytmMerchant.findById(attempt.merchant?._id || attempt.merchant).select('+merchantKey');
      if (merchant) {
        const liveCheck = await queryPaytmOrderStatus({
          mid: attempt.paytmMid,
          merchantKey: merchant.merchantKey,
          orderId: attempt.paytmTxnRef,
          environment: merchant.environment,
        });

        if (liveCheck.isSuccess) {
          await fulfillSuccessfulPaytmPayment(attempt, liveCheck, merchant, 'polling');
          return res.status(200).json({
            success: true,
            status: 'SUCCESS',
            isPaid: true,
            transactionId: liveCheck.txnId,
            bankTxnId: liveCheck.bankTxnId,
            orderId: attempt.order,
            message: 'Payment received and verified successfully!',
          });
        }
      }

      attempt.status = 'EXPIRED';
      await attempt.save();
      return res.status(200).json({
        success: true,
        status: 'EXPIRED',
        isPaid: false,
        message: 'Payment session expired. Please generate a fresh Dynamic QR code.',
      });
    }

    // 4. Live check with Paytm Order Status API
    const merchant = await PaytmMerchant.findById(attempt.merchant?._id || attempt.merchant).select('+merchantKey');
    if (!merchant) {
      return res.status(200).json({
        success: true,
        status: 'PENDING',
        isPaid: false,
        message: 'Payment is awaiting confirmation',
      });
    }

    const liveCheck = await queryPaytmOrderStatus({
      mid: attempt.paytmMid,
      merchantKey: merchant.merchantKey,
      orderId: attempt.paytmTxnRef,
      environment: merchant.environment,
    });

    // Record verification log
    await PaymentVerificationLog.create({
      paymentAttempt: attempt._id,
      order: attempt.order,
      source: 'polling',
      requestPayload: { mid: attempt.paytmMid, orderId: attempt.paytmTxnRef },
      responsePayload: liveCheck.rawResponse || {},
      verifiedStatus: liveCheck.normalizedStatus,
      verifiedAmount: liveCheck.amount,
      paytmTxnId: liveCheck.txnId,
      bankTxnId: liveCheck.bankTxnId,
      ipAddress: req.ip || '',
    }).catch(() => {});

    // If verified success:
    if (liveCheck.isSuccess) {
      // Validate exact amount
      if (liveCheck.amount !== null && Math.abs(liveCheck.amount - attempt.amount) > 0.01) {
        return res.status(400).json({
          success: false,
          status: 'AMOUNT_MISMATCH',
          message: 'Received transaction amount does not match the order total.',
        });
      }

      await fulfillSuccessfulPaytmPayment(attempt, liveCheck, merchant, 'polling');

      return res.status(200).json({
        success: true,
        status: 'SUCCESS',
        isPaid: true,
        transactionId: liveCheck.txnId,
        bankTxnId: liveCheck.bankTxnId,
        orderId: attempt.order,
        message: 'Payment received and verified successfully!',
      });
    }

    // Only fail if it is a genuine bank failure with an actual transaction ID
    if (liveCheck.isFailed && liveCheck.txnId) {
      attempt.status = 'TXN_FAILURE';
      await attempt.save();
      return res.status(200).json({
        success: true,
        status: 'FAILURE',
        isPaid: false,
        message: liveCheck.responseMessage || 'Paytm payment was declined or failed',
      });
    }

    // Still pending
    return res.status(200).json({
      success: true,
      status: 'PENDING',
      isPaid: false,
      message: 'Awaiting bank confirmation. Please scan the QR code and complete the payment.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle incoming callback / webhook notification from Paytm
 * POST /api/payments/paytm/callback
 */
export const handlePaytmCallback = async (req, res, next) => {
  try {
    const callbackData = req.body || {};
    const { MID, ORDERID, STATUS, TXNAMOUNT, CHECKSUMHASH, TXNID, BANKTXNID } = callbackData;

    if (!MID || !ORDERID) {
      return res.status(400).send('Invalid callback payload: missing MID or ORDERID');
    }

    // Locate payment attempt by paytmTxnRef or merchantOrderId
    const attempt = await PaymentAttempt.findOne({
      $or: [{ paytmTxnRef: ORDERID }, { merchantOrderId: ORDERID }],
    });

    if (!attempt) {
      return res.status(404).send('Matching payment attempt not found');
    }

    const merchant = await PaytmMerchant.findById(attempt.merchant).select('+merchantKey');
    if (!merchant) {
      return res.status(400).send('Associated merchant not found');
    }

    // Verify signature if provided
    if (CHECKSUMHASH && merchant.merchantKey) {
      const isValid = verifyPaytmSignature(callbackData, merchant.merchantKey, CHECKSUMHASH);
      if (!isValid) {
        console.warn('Paytm callback checksum verification failed!');
        return res.status(400).send('Invalid checksum signature');
      }
    }

    // Log callback
    await PaymentVerificationLog.create({
      paymentAttempt: attempt._id,
      order: attempt.order,
      source: 'callback',
      requestPayload: callbackData,
      responsePayload: {},
      verifiedStatus: STATUS || 'UNKNOWN',
      verifiedAmount: parseFloat(TXNAMOUNT) || null,
      paytmTxnId: TXNID || '',
      bankTxnId: BANKTXNID || '',
      ipAddress: req.ip || '',
    }).catch(() => {});

    if (STATUS === 'TXN_SUCCESS') {
      const liveCheck = {
        isSuccess: true,
        txnId: TXNID,
        bankTxnId: BANKTXNID,
        amount: parseFloat(TXNAMOUNT),
        gatewayName: callbackData.GATEWAYNAME || 'UPI',
      };

      await fulfillSuccessfulPaytmPayment(attempt, liveCheck, merchant, 'callback');
      return res.status(200).send('SUCCESS');
    } else {
      attempt.status = 'TXN_FAILURE';
      await attempt.save();
      return res.status(200).send('FAILED');
    }
  } catch (error) {
    console.error('Error handling Paytm callback:', error);
    next(error);
  }
};

/**
 * Customer cancels payment session
 * POST /api/payments/paytm/cancel/:paymentId
 */
export const cancelPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const attempt = await PaymentAttempt.findById(paymentId);
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Payment attempt session not found' });
    }

    if (attempt.status === 'TXN_SUCCESS') {
      return res.status(400).json({ success: false, message: 'Cannot cancel an already completed payment' });
    }

    attempt.status = 'CANCELLED';
    await attempt.save();

    res.status(200).json({ success: true, message: 'Payment cancelled successfully' });
  } catch (error) {
    next(error);
  }
};

