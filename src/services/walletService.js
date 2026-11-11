import crypto from 'crypto';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import CashbackTransaction from '../models/CashbackTransaction.js';
import Notification from '../models/Notification.js';
import { notifyWalletTransaction } from './pushNotificationService.js';

/**
 * Get or automatically create a wallet for a user
 * @param {string|mongoose.Types.ObjectId} userId
 */
export const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await Wallet.create({
      user: userId,
      balance: 0,
      totalAdded: 0,
      totalSpent: 0,
      totalCashback: 0,
      currency: 'INR',
      isActive: true,
    });
  }
  return wallet;
};

/**
 * Helper to generate unique human-readable transaction IDs
 */
const generateTransactionId = (prefix = 'WTX') => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Credit customer wallet with immutable ledger entry
 */
export const creditWallet = async ({
  userId,
  amountPaise,
  type = 'topup',
  description = 'Wallet credited',
  relatedOrder = null,
  adminUser = null,
  adminReason = null,
  metadata = {},
}) => {
  if (typeof amountPaise !== 'number' || amountPaise <= 0 || !Number.isInteger(amountPaise)) {
    throw new Error('Credit amount must be a positive integer in paise');
  }

  const wallet = await getOrCreateWallet(userId);
  if (!wallet.isActive) {
    throw new Error('Wallet is inactive or suspended');
  }

  const previousBalance = wallet.balance;
  const newBalance = previousBalance + amountPaise;

  const incFields = { balance: amountPaise };
  if (type === 'topup' || type === 'admin_credit') {
    incFields.totalAdded = amountPaise;
  } else if (type === 'cashback') {
    incFields.totalCashback = amountPaise;
  }

  // Atomically increment wallet
  const updatedWallet = await Wallet.findOneAndUpdate(
    { _id: wallet._id, isActive: true },
    { $inc: incFields },
    { new: true }
  );

  const transactionId = generateTransactionId(type === 'cashback' ? 'CBK' : 'WTX');

  const transaction = await WalletTransaction.create({
    transactionId,
    wallet: wallet._id,
    user: userId,
    type,
    amount: amountPaise,
    previousBalance,
    newBalance,
    relatedOrder,
    description,
    status: 'completed',
    adminUser,
    adminReason,
    metadata,
  });

  // Notify customer
  try {
    notifyWalletTransaction({
      user: userId,
      type: 'credit',
      amount: (amountPaise / 100).toFixed(2),
      balance: (newBalance / 100).toFixed(2),
      description,
    }).catch((e) => console.log('Wallet push error:', e.message));
  } catch (err) {
    console.error('Failed to create notification for wallet credit:', err.message);
  }

  return { wallet: updatedWallet, transaction };
};

/**
 * Debit customer wallet with atomic balance check & immutable ledger entry
 */
export const debitWallet = async ({
  userId,
  amountPaise,
  type = 'purchase',
  description = 'Wallet debited',
  relatedOrder = null,
  adminUser = null,
  adminReason = null,
  metadata = {},
}) => {
  if (typeof amountPaise !== 'number' || amountPaise <= 0 || !Number.isInteger(amountPaise)) {
    throw new Error('Debit amount must be a positive integer in paise');
  }

  const wallet = await getOrCreateWallet(userId);
  if (!wallet.isActive) {
    throw new Error('Wallet is inactive or suspended');
  }

  if (wallet.balance < amountPaise) {
    throw new Error(
      `Insufficient wallet balance. Required: ₹${(amountPaise / 100).toFixed(2)}, Available: ₹${(
        wallet.balance / 100
      ).toFixed(2)}`
    );
  }

  const previousBalance = wallet.balance;

  // Atomically decrement using conditional query to prevent race condition/negative balance
  const updatedWallet = await Wallet.findOneAndUpdate(
    { _id: wallet._id, balance: { $gte: amountPaise }, isActive: true },
    {
      $inc: {
        balance: -amountPaise,
        totalSpent: amountPaise,
      },
    },
    { new: true }
  );

  if (!updatedWallet) {
    throw new Error('Concurrent wallet modification detected or insufficient funds during transaction.');
  }

  const newBalance = updatedWallet.balance;
  const transactionId = generateTransactionId('WTX');

  const transaction = await WalletTransaction.create({
    transactionId,
    wallet: wallet._id,
    user: userId,
    type,
    amount: amountPaise,
    previousBalance,
    newBalance,
    relatedOrder,
    description,
    status: 'completed',
    adminUser,
    adminReason,
    metadata,
  });

  // Notify customer
  try {
    notifyWalletTransaction({
      user: userId,
      type: 'debit',
      amount: (amountPaise / 100).toFixed(2),
      balance: (newBalance / 100).toFixed(2),
      description,
    }).catch((e) => console.log('Wallet debit push error:', e.message));
  } catch (err) {
    console.error('Failed to create notification for wallet debit:', err.message);
  }

  return { wallet: updatedWallet, transaction };
};

/**
 * Promotional cashback processor for completed purchases
 * Gives 5% cashback on purchases, capped at ₹500 (50000 paise)
 */
export const processOrderCashback = async ({ order, user }) => {
  try {
    if (!order || order.totalAmount <= 0) return null;

    // e.g. 5% promotional cashback
    const ratePercent = 5;
    const maxCashbackPaise = 50000; // ₹500
    const rawCashbackPaise = Math.round((order.totalAmount * 100 * ratePercent) / 100);
    const cashbackAmountPaise = Math.min(rawCashbackPaise, maxCashbackPaise);

    if (cashbackAmountPaise <= 0) return null;

    const wallet = await getOrCreateWallet(order.user);

    // Create cashback transaction record
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90); // 90 days validity

    const cashbackRecord = await CashbackTransaction.create({
      user: order.user,
      wallet: wallet._id,
      order: order._id,
      rule: '5% Welcome/Promotional Marketplace Cashback',
      amount: cashbackAmountPaise,
      expiryDate: expiryDate,
      status: 'credited',
      description: `Cashback for Order #${order.orderNumber || order._id}`,
    });

    // Credit wallet
    await creditWallet({
      userId: order.user,
      amountPaise: cashbackAmountPaise,
      type: 'cashback',
      description: `Cashback for Order #${order.orderNumber}`,
      relatedOrder: order._id,
      metadata: { cashbackRecordId: cashbackRecord._id, ratePercent },
    });

    return cashbackRecord;
  } catch (error) {
    console.error('Error applying order cashback:', error.message);
    return null;
  }
};

/**
 * Reconcile wallet ledger against reported wallet balance
 */
export const reconcileWallet = async (userId) => {
  const wallet = await getOrCreateWallet(userId);
  const transactions = await WalletTransaction.find({ user: userId, status: 'completed' });

  let computedBalance = 0;
  let computedAdded = 0;
  let computedSpent = 0;
  let computedCashback = 0;

  for (const tx of transactions) {
    switch (tx.type) {
      case 'topup':
      case 'admin_credit':
        computedBalance += tx.amount;
        computedAdded += tx.amount;
        break;
      case 'cashback':
        computedBalance += tx.amount;
        computedCashback += tx.amount;
        break;
      case 'refund':
        computedBalance += tx.amount;
        break;
      case 'purchase':
      case 'admin_debit':
      case 'reversal':
        computedBalance -= tx.amount;
        computedSpent += tx.amount;
        break;
      default:
        break;
    }
  }

  const isMatched = computedBalance === wallet.balance;

  return {
    userId,
    isMatched,
    currentBalancePaise: wallet.balance,
    ledgerBalancePaise: computedBalance,
    discrepancyPaise: wallet.balance - computedBalance,
    totalAddedPaise: wallet.totalAdded,
    totalSpentPaise: wallet.totalSpent,
    totalCashbackPaise: wallet.totalCashback,
    transactionCount: transactions.length,
  };
};

