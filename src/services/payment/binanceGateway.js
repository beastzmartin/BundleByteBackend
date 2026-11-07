import crypto from 'crypto';
import Payment from '../../models/Payment.js';
import PaymentVerification from '../../models/PaymentVerification.js';
import {
  getBinanceCredentials,
  fetchBinanceDepositAddress,
  verifyBinanceDeposit,
} from './binanceService.js';

export const binanceGateway = {
  /**
   * Create Binance USDT payment session with unique reference and deposit address
   */
  createPaymentSession: async ({ order, user, amount, currency, orderId, userId }) => {
    const creds = await getBinanceCredentials();
    const paymentAmount = order ? order.totalAmount : amount;
    const paymentCurrency = order ? order.currency : (currency || 'USD');
    const paymentUser = user ? (user._id || user) : userId;

    // Calculate USDT amount
    let usdtAmount = paymentAmount;
    if (paymentCurrency === 'INR') {
      usdtAmount = +(paymentAmount / (creds.usdtToInrRate || 86.5)).toFixed(2);
    } else {
      usdtAmount = +(paymentAmount * (creds.usdtToUsdRate || 1.0)).toFixed(2);
    }

    // Minimum 1 USDT
    if (usdtAmount < 1.0) usdtAmount = 1.0;

    // Generate unique payment reference for Binance
    const referenceCode = `REF-BN-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const transactionId = `BINANCE-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Get active deposit address
    const addressInfo = await fetchBinanceDepositAddress({ coin: 'USDT', network: creds.network });

    const payment = await Payment.create({
      order: order ? order._id : null,
      user: paymentUser,
      amount: paymentAmount,
      currency: paymentCurrency,
      gateway: 'binance',
      status: 'initiated',
      transactionId,
      gatewayReference: referenceCode,
      metadata: {
        paymentType: 'binance_usdt',
        usdtAmount,
        network: addressInfo.network || creds.network,
        depositAddress: addressInfo.address,
        addressTag: addressInfo.tag || '',
        referenceCode,
      },
    });

    return {
      gateway: 'binance',
      transactionId,
      paymentId: payment._id,
      referenceCode,
      depositAddress: addressInfo.address,
      network: addressInfo.network || creds.network,
      coin: 'USDT',
      usdtAmount,
      amount: paymentAmount,
      currency: paymentCurrency,
      instructions: `Please transfer exactly ${usdtAmount} USDT to the address below via ${addressInfo.network || creds.network} network. Include Reference "${referenceCode}" in transfer memo if supported.`,
    };
  },

  /**
   * Verify customer submitted TxID via Binance Deposit History API
   */
  verifyPayment: async ({
    transactionId,
    txId,
    expectedAmount,
    orderId,
    userId,
    isWalletTopup = false,
    walletAmountPaise = 0,
  }) => {
    const checkTxId = txId || transactionId;
    if (!checkTxId) {
      return { verified: false, message: 'Missing transaction hash / TxID' };
    }

    // Anti-replay check: ensure this TxID hasn't already been approved
    const duplicate = await PaymentVerification.findOne({
      transactionId: checkTxId.trim(),
      status: 'approved',
    });

    if (duplicate) {
      return {
        verified: false,
        message: `This transaction ID (${checkTxId}) has already been used and credited. Duplicate submissions are not allowed.`,
      };
    }

    // Verify against Binance official deposit history API
    const verification = await verifyBinanceDeposit({
      txId: checkTxId.trim(),
      expectedAmount: expectedAmount || 0,
      coin: 'USDT',
    });

    let payment = await Payment.findOne({
      $or: [{ transactionId }, { gatewayReference: transactionId }],
    });

    if (verification.verified) {
      if (payment) {
        payment.status = 'success';
        payment.metadata = {
          ...payment.metadata,
          txId: checkTxId.trim(),
          verifiedAt: new Date(),
          binanceDepositRecord: verification.deposit,
        };
        await payment.save();
      }

      // Record in PaymentVerification as auto-approved
      await PaymentVerification.create({
        order: orderId || payment?.order,
        user: userId || payment?.user,
        paymentType: 'binance_usdt',
        referenceCode: payment?.gatewayReference || `REF-BN-${Date.now().toString().slice(-6)}`,
        transactionId: checkTxId.trim(),
        amount: verification.deposit.amount,
        currency: 'USDT',
        status: 'approved',
        verificationSource: 'binance_api_auto',
        verifiedAt: new Date(),
        rawDetails: verification.deposit,
        isWalletTopup: !!isWalletTopup,
        walletAmountPaise: isWalletTopup ? walletAmountPaise : 0,
        adminNotes: `Auto-verified via Binance Deposit History API on ${verification.deposit.network} network.`,
      });

      return {
        verified: true,
        payment,
        deposit: verification.deposit,
        message: verification.message,
      };
    } else {
      // Create pending claim for admin manual reconciliation
      const claim = await PaymentVerification.create({
        order: orderId || payment?.order,
        user: userId || payment?.user,
        paymentType: 'binance_usdt',
        referenceCode: payment?.gatewayReference || `REF-BN-${Date.now().toString().slice(-6)}`,
        transactionId: checkTxId.trim(),
        amount: expectedAmount || 0,
        currency: 'USDT',
        status: 'pending',
        verificationSource: 'none',
        rejectionReason: verification.message,
        isWalletTopup: !!isWalletTopup,
        walletAmountPaise: isWalletTopup ? walletAmountPaise : 0,
        adminNotes: 'Submitted by customer; awaiting blockchain confirmations or manual reconciliation.',
      });

      return {
        verified: false,
        pendingReview: true,
        claimId: claim._id,
        message: verification.message || 'Deposit TxID recorded for manual review.',
      };
    }
  },

  processRefund: async ({ payment, amount, reason }) => {
    payment.status = 'refunded';
    payment.webhookEvents.push({
      eventName: 'binance.refund_logged',
      receivedAt: new Date(),
      payload: { amount, reason },
    });
    await payment.save();
    return { success: true, message: 'Binance refund logged for manual return' };
  },
};

