import crypto from 'crypto';
import Payment from '../../models/Payment.js';
import PaymentVerification from '../../models/PaymentVerification.js';
import WebsiteSetting from '../../models/WebsiteSetting.js';
import { verifyUtrRecord } from './upiService.js';

export const upiGateway = {
  /**
   * Create UPI payment session with dynamic QR generation parameters & reference
   */
  createPaymentSession: async ({ order, user, amount, currency, orderId, userId }) => {
    const settings = await WebsiteSetting.findOne();
    const upiConfig = settings?.gateways?.upi || {};

    const paymentAmount = order ? order.totalAmount : amount;
    const paymentCurrency = order ? order.currency : (currency || 'INR');
    const paymentUser = user ? (user._id || user) : userId;

    // Convert to INR if in USD (default ~86.5 INR per USD)
    let inrAmount = paymentAmount;
    if (paymentCurrency === 'USD') {
      const rate = settings?.gateways?.binance?.usdtToInrRate || 86.5;
      inrAmount = Math.round(paymentAmount * rate);
    }

    const referenceCode = `REF-UPI-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const transactionId = `UPI-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const upiId = upiConfig.upiId || 'bundlebyte@icici';
    const merchantName = upiConfig.merchantName || 'BundleByte Technologies';

    // Standard NPCI UPI URI Scheme
    const upiIntentUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${inrAmount}&cu=INR&tn=${encodeURIComponent(referenceCode)}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiIntentUri)}`;

    const payment = await Payment.create({
      order: order ? order._id : null,
      user: paymentUser,
      amount: inrAmount,
      currency: 'INR',
      gateway: 'upi',
      status: 'initiated',
      transactionId,
      gatewayReference: referenceCode,
      metadata: {
        paymentType: 'upi_utr',
        inrAmount,
        upiId,
        merchantName,
        referenceCode,
        upiIntentUri,
      },
    });

    return {
      gateway: 'upi',
      transactionId,
      paymentId: payment._id,
      referenceCode,
      upiId,
      merchantName,
      inrAmount,
      currency: 'INR',
      upiIntentUri,
      qrCodeUrl,
      instructions: `Scan the UPI QR code using Google Pay, PhonePe, Paytm, or BHIM. After paying ₹${inrAmount}, copy the 12-digit UTR / UPI Ref No. from your payment receipt and enter it below to verify.`,
    };
  },

  /**
   * Verify customer submitted UTR against trusted records or queue for admin approval
   */
  verifyPayment: async ({
    transactionId,
    utrNumber,
    expectedAmount,
    orderId,
    userId,
    isWalletTopup = false,
    walletAmountPaise = 0,
  }) => {
    const checkUtr = utrNumber || transactionId;
    if (!checkUtr) {
      return { verified: false, message: 'Missing UPI UTR / Transaction Reference Number' };
    }

    const verification = await verifyUtrRecord({
      utrNumber: checkUtr.trim(),
      expectedAmount: expectedAmount || 0,
      currency: 'INR',
      orderId,
      userId,
    });

    let payment = await Payment.findOne({
      $or: [{ transactionId }, { gatewayReference: transactionId }],
    });

    if (verification.verified && verification.autoApproved) {
      if (payment) {
        payment.status = 'success';
        payment.metadata = {
          ...payment.metadata,
          utrNumber: checkUtr.trim(),
          verifiedAt: new Date(),
          trustedLedgerRecord: verification.record,
        };
        await payment.save();
      }

      await PaymentVerification.create({
        order: orderId || payment?.order,
        user: userId || payment?.user,
        paymentType: 'upi_utr',
        referenceCode: payment?.gatewayReference || `REF-UPI-${Date.now().toString().slice(-6)}`,
        transactionId: checkUtr.trim(),
        amount: verification.record.amount,
        currency: 'INR',
        status: 'approved',
        verificationSource: 'trusted_ledger_auto',
        verifiedAt: new Date(),
        rawDetails: verification.record,
        isWalletTopup: !!isWalletTopup,
        walletAmountPaise: isWalletTopup ? walletAmountPaise : 0,
        adminNotes: 'Auto-verified against trusted bank settlement ledger.',
      });

      return {
        verified: true,
        payment,
        message: verification.message,
      };
    } else {
      // Create pending claim for admin manual reconciliation
      const claim = await PaymentVerification.create({
        order: orderId || payment?.order,
        user: userId || payment?.user,
        paymentType: 'upi_utr',
        referenceCode: payment?.gatewayReference || `REF-UPI-${Date.now().toString().slice(-6)}`,
        transactionId: checkUtr.trim(),
        amount: expectedAmount || 0,
        currency: 'INR',
        status: 'pending',
        verificationSource: 'none',
        rejectionReason: '',
        isWalletTopup: !!isWalletTopup,
        walletAmountPaise: isWalletTopup ? walletAmountPaise : 0,
        adminNotes: verification.message || 'Customer submitted UTR; pending admin bank statement reconciliation.',
      });

      return {
        verified: false,
        pendingReview: true,
        claimId: claim._id,
        message: verification.message,
      };
    }
  },

  processRefund: async ({ payment, amount, reason }) => {
    payment.status = 'refunded';
    payment.webhookEvents.push({
      eventName: 'upi.refund_logged',
      receivedAt: new Date(),
      payload: { amount, reason },
    });
    await payment.save();
    return { success: true, message: 'UPI refund logged for manual bank transfer' };
  },
};

