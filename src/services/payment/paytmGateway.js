import crypto from 'crypto';
import Payment from '../../models/Payment.js';
import PaymentAttempt from '../../models/PaymentAttempt.js';
import PaytmMerchant from '../../models/PaytmMerchant.js';
import WebsiteSetting from '../../models/WebsiteSetting.js';
import {
  generateUpiPaymentUri,
  generatePaytmIntentDeepLink,
  generateQrCodeUrl,
  queryPaytmOrderStatus,
} from './paytmService.js';
import { selectMerchantForPayment } from './paytmRoutingEngine.js';

export const paytmGateway = {
  /**
   * Create dynamic Paytm QR payment session with multi-merchant routing
   */
  createPaymentSession: async ({ order, user, amount, currency, orderId, userId }) => {
    const settings = await WebsiteSetting.findOne();

    const paymentAmount = order ? order.totalAmount : amount;
    const paymentCurrency = order ? order.currency : currency || 'INR';
    const paymentUser = user ? user._id || user : userId;

    // If order has baseAmount, prioritize base INR amount
    let inrAmount = order ? (order.baseAmount || order.processingAmount || order.totalAmount) : amount;
    if (!order && paymentCurrency !== 'INR') {
      const exchangeRateService = (await import('../currency/exchangeRateService.js')).default;
      const rateInfo = await exchangeRateService.getExchangeRate('INR', paymentCurrency);
      inrAmount = parseFloat((paymentAmount * (rateInfo.rateInverse || 88.50)).toFixed(2));
    }

    // Select eligible merchant via Multi-Merchant Routing Engine
    const selectedMerchant = await selectMerchantForPayment({ amount: inrAmount });

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const merchantOrderId = `PTM-${Date.now()}-${randomSuffix}`;
    const paytmTxnRef = `REF${Date.now()}${randomSuffix}`;
    const paytmRemark = `TXN${Math.floor(100 + Math.random() * 900)}${Date.now()}${Math.floor(1 + Math.random() * 100)}`;

    const upiUri = generateUpiPaymentUri({
      upiId: selectedMerchant.upiId,
      merchantName: selectedMerchant.merchantName,
      amount: inrAmount,
      txnRef: paytmTxnRef,
      remark: paytmRemark,
    });

    const paytmIntentUri = generatePaytmIntentDeepLink({
      upiId: selectedMerchant.upiId,
      merchantName: selectedMerchant.merchantName,
      amount: inrAmount,
      txnRef: paytmTxnRef,
      remark: paytmRemark,
    });

    const qrCodeUrl = generateQrCodeUrl(upiUri);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const paymentAttempt = await PaymentAttempt.create({
      order: order ? order._id : orderId || null,
      user: paymentUser,
      merchant: selectedMerchant._id,
      merchantName: selectedMerchant.merchantName,
      paytmMid: selectedMerchant.mid,
      merchantOrderId,
      paytmTxnRef,
      paytmRemark,
      amount: inrAmount,
      currency: 'INR',
      upiUri,
      paytmIntentUri,
      qrCodeUrl,
      status: 'PENDING',
      expiresAt,
    });

    const payment = await Payment.create({
      order: order ? order._id : orderId || null,
      user: paymentUser,
      amount: inrAmount,
      currency: 'INR',
      gateway: 'paytm',
      status: 'initiated',
      transactionId: merchantOrderId,
      gatewayReference: paytmTxnRef,
      metadata: {
        paymentAttemptId: paymentAttempt._id,
        paytmMid: selectedMerchant.mid,
        merchantName: selectedMerchant.merchantName,
        upiId: selectedMerchant.upiId,
        upiUri,
        paytmIntentUri,
        qrCodeUrl,
        expiresAt,
      },
    });

    return {
      transactionId: merchantOrderId,
      paymentAttemptId: paymentAttempt._id,
      paytmTxnRef,
      merchantName: selectedMerchant.merchantName,
      mid: selectedMerchant.mid,
      amount: inrAmount,
      currency: 'INR',
      upiUri,
      paytmIntentUri,
      qrCodeUrl,
      expiresAt,
      countdownSeconds: 300,
      payment,
    };
  },

  /**
   * Verify Paytm payment status
   */
  verifyPayment: async ({ transactionId, paymentAttemptId }) => {
    let attempt = null;
    if (paymentAttemptId) {
      attempt = await PaymentAttempt.findById(paymentAttemptId);
    }
    if (!attempt && transactionId) {
      attempt = await PaymentAttempt.findOne({
        $or: [{ merchantOrderId: transactionId }, { paytmTxnRef: transactionId }],
      });
    }

    if (!attempt) {
      return { verified: false, message: 'Payment attempt record not found' };
    }

    if (attempt.status === 'TXN_SUCCESS') {
      return {
        verified: true,
        payment: { order: attempt.order },
        transactionId: attempt.paytmTxnId,
        bankTxnId: attempt.bankTxnId,
      };
    }

    const merchant = await PaytmMerchant.findById(attempt.merchant).select('+merchantKey');
    if (!merchant) {
      return { verified: false, message: 'Associated merchant configuration not found' };
    }

    const liveCheck = await queryPaytmOrderStatus({
      mid: attempt.paytmMid,
      merchantKey: merchant.merchantKey,
      orderId: attempt.paytmTxnRef,
      environment: merchant.environment,
    });

    if (liveCheck.isSuccess) {
      return {
        verified: true,
        payment: { order: attempt.order },
        transactionId: liveCheck.txnId,
        bankTxnId: liveCheck.bankTxnId,
        amount: liveCheck.amount,
      };
    }

    return {
      verified: false,
      message: liveCheck.responseMessage || 'Payment is still awaiting confirmation.',
    };
  },
};

