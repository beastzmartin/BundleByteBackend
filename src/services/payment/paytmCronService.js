import PaymentAttempt from '../../models/PaymentAttempt.js';
import PaytmMerchant from '../../models/PaytmMerchant.js';
import Order from '../../models/Order.js';
import User from '../../models/User.js';
import Payment from '../../models/Payment.js';
import PaymentVerificationLog from '../../models/PaymentVerificationLog.js';
import TransactionReconciliation from '../../models/TransactionReconciliation.js';
import { queryPaytmOrderStatus } from './paytmService.js';
import { processOrderKeyDelivery } from '../keyDeliveryEngine.js';
import { creditWallet } from '../walletService.js';
import { sendPaymentConfirmationEmail, sendWalletTopupEmail } from '../emailService.js';

let cronInterval = null;
let isCronRunning = false;

/**
 * Execute a single pass of automatic verification for pending Paytm payments
 */
export const runPaytmPendingVerificationPass = async () => {
  if (isCronRunning) return;
  isCronRunning = true;

  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const now = new Date();

    // Find pending attempts created in the last 15 minutes
    const pendingAttempts = await PaymentAttempt.find({
      status: 'PENDING',
      createdAt: { $gte: fifteenMinutesAgo },
    })
      .populate('merchant')
      .limit(20);

    for (const attempt of pendingAttempts) {
      try {
        // If expired by timeout (e.g. 5 minutes have elapsed)
        if (attempt.expiresAt && new Date(attempt.expiresAt) < now) {
          // Check one final time before expiring
          const merchant = await PaytmMerchant.findById(attempt.merchant?._id || attempt.merchant).select('+merchantKey');
          if (!merchant) {
            attempt.status = 'EXPIRED';
            await attempt.save();
            continue;
          }

          const statusRes = await queryPaytmOrderStatus({
            mid: attempt.paytmMid,
            merchantKey: merchant.merchantKey,
            orderId: attempt.paytmTxnRef,
            environment: merchant.environment,
          });

          if (statusRes.isSuccess && statusRes.amount === attempt.amount) {
            await fulfillSuccessfulPaytmPayment(attempt, statusRes, merchant, 'cron');
          } else {
            attempt.status = 'EXPIRED';
            await attempt.save();
          }
          continue;
        }

        // Active pending attempt: query Paytm Order Status
        const merchant = await PaytmMerchant.findById(attempt.merchant?._id || attempt.merchant).select('+merchantKey');
        if (!merchant) continue;

        const statusRes = await queryPaytmOrderStatus({
          mid: attempt.paytmMid,
          merchantKey: merchant.merchantKey,
          orderId: attempt.paytmTxnRef,
          environment: merchant.environment,
        });

        // Log verification attempt
        await PaymentVerificationLog.create({
          paymentAttempt: attempt._id,
          order: attempt.order,
          source: 'cron',
          requestPayload: { mid: attempt.paytmMid, orderId: attempt.paytmTxnRef },
          responsePayload: statusRes.rawResponse || {},
          verifiedStatus: statusRes.normalizedStatus,
          verifiedAmount: statusRes.amount,
          paytmTxnId: statusRes.txnId,
          bankTxnId: statusRes.bankTxnId,
        });

        if (statusRes.isSuccess) {
          // Exact amount validation
          if (statusRes.amount !== null && Math.abs(statusRes.amount - attempt.amount) > 0.01) {
            console.warn(`Paytm payment amount mismatch! Expected: ${attempt.amount}, Got: ${statusRes.amount}`);
            continue;
          }

          await fulfillSuccessfulPaytmPayment(attempt, statusRes, merchant, 'cron');
        } else if (statusRes.isFailed) {
          attempt.status = 'TXN_FAILURE';
          await attempt.save();
        }
      } catch (innerErr) {
        console.error(`Error processing pending Paytm attempt ${attempt._id}:`, innerErr);
      }
    }
  } catch (error) {
    console.error('Error in Paytm pending verification cron:', error);
  } finally {
    isCronRunning = false;
  }
};

/**
 * Fulfill a verified Paytm payment (for Order or Wallet Top-up)
 */
export const fulfillSuccessfulPaytmPayment = async (attempt, statusRes, merchant, source = 'polling') => {
  // Idempotency check: if already completed, do not re-process
  if (attempt.status === 'TXN_SUCCESS') return;

  const txnId = statusRes.txnId || `PTM-TXN-${Date.now()}`;
  const bankTxnId = statusRes.bankTxnId || '';

  attempt.status = 'TXN_SUCCESS';
  attempt.paytmTxnId = txnId;
  attempt.bankTxnId = bankTxnId;
  attempt.gatewayName = statusRes.gatewayName || 'UPI';
  attempt.verifiedAt = new Date();
  attempt.verificationSource = source;
  await attempt.save();

  // Update merchant transaction stats
  merchant.successfulTransactions += 1;
  merchant.currentDailyVolume += attempt.amount;
  await merchant.save();

  // Create or update Transaction Reconciliation record
  await TransactionReconciliation.findOneAndUpdate(
    { paymentAttempt: attempt._id },
    {
      order: attempt.order,
      merchant: merchant._id,
      paytmMid: attempt.paytmMid,
      merchantOrderId: attempt.merchantOrderId,
      paytmTxnId: txnId,
      bankTxnId,
      expectedAmount: attempt.amount,
      settledAmount: statusRes.amount || attempt.amount,
      currency: attempt.currency || 'INR',
      status: 'matched',
      reconciledAt: new Date(),
      reconciliationNotes: `Reconciled via ${source} verification`,
    },
    { upsert: true, new: true }
  );

  // 1. If this was for a Wallet Top-up:
  if (attempt.isWalletTopup) {
    const paise = Math.round(attempt.amount * 100);
    await creditWallet({
      userId: attempt.user,
      amountPaise: paise,
      type: 'topup',
      description: `Paytm Dynamic QR Top-Up verified (Txn: ${txnId}${bankTxnId ? `, UTR: ${bankTxnId}` : ''})`,
      metadata: {
        paymentAttemptId: attempt._id,
        paytmMid: attempt.paytmMid,
        paytmTxnId: txnId,
        bankTxnId,
        gateway: 'paytm',
      },
    });

    const user = await User.findById(attempt.user);
    if (user?.email) {
      await sendWalletTopupEmail({
        user,
        amount: attempt.amount,
        balance: (user.walletBalance || 0) + attempt.amount,
        transactionId: txnId,
        currency: 'INR',
      }).catch(() => {});
    }

    return;
  }

  // 2. If this was for an Order checkout:
  if (attempt.order) {
    const order = await Order.findById(attempt.order);
    if (order) {
      // If already paid and delivered, avoid double-delivery
      if (order.paymentStatus === 'paid' && order.deliveryStatus === 'delivered') {
        return;
      }

      order.paymentStatus = 'paid';
      order.orderStatus = 'processing';
      order.paymentMethod = 'paytm';
      order.paymentDetails = {
        transactionId: txnId,
        gateway: 'paytm',
        paidAt: new Date(),
        receiptUrl: '',
      };
      await order.save();

      // Create Payment document
      await Payment.findOneAndUpdate(
        { transactionId: txnId },
        {
          order: order._id,
          user: attempt.user,
          amount: attempt.amount,
          currency: attempt.currency || 'INR',
          gateway: 'paytm',
          status: 'success',
          gatewayReference: attempt.merchantOrderId,
          metadata: {
            paytmMid: attempt.paytmMid,
            paytmTxnId: txnId,
            bankTxnId,
            paymentAttemptId: attempt._id,
          },
        },
        { upsert: true, new: true }
      );

      // Trigger digital delivery engine (delivers keys, credentials, software links, etc.)
      const customer = await User.findById(order.user);
      await processOrderKeyDelivery(order, customer).catch((err) => {
        console.error('Error in automated key delivery after Paytm payment:', err);
      });

      // Send confirmation email
      if (customer?.email) {
        await sendPaymentConfirmationEmail({
          order,
          user: customer,
          paymentDetails: order.paymentDetails,
        }).catch(() => {});
      }
    }
  }
};

/**
 * Start the background verification cron worker
 */
export const startPaytmCronWorker = () => {
  if (cronInterval) return;
  // Run every 30 seconds
  cronInterval = setInterval(runPaytmPendingVerificationPass, 30 * 1000);
  console.log('🔄 Paytm automatic payment verification worker started (interval: 30s)');
};

/**
 * Stop the background verification cron worker
 */
export const stopPaytmCronWorker = () => {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
};

