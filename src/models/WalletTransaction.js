import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'topup',
        'purchase',
        'refund',
        'cashback',
        'admin_credit',
        'admin_debit',
        'reversal',
      ],
      required: true,
      index: true,
    },
    // Amount stored in minor units (paise / cents) of base currency
    amount: {
      type: Number,
      required: true,
      min: [1, 'Amount must be at least 1 unit'],
    },
    baseCurrency: {
      type: String,
      default: 'INR',
    },
    originalAmount: {
      type: Number,
      default: null,
    },
    originalCurrency: {
      type: String,
      default: 'INR',
    },
    appliedExchangeRate: {
      type: Number,
      default: 1.0,
    },
    exchangeMargin: {
      type: Number,
      default: 0,
    },
    fee: {
      type: Number,
      default: 0,
    },
    previousBalance: {
      type: Number,
      required: true,
    },
    newBalance: {
      type: Number,
      required: true,
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['completed', 'pending', 'failed', 'reversed'],
      default: 'completed',
      index: true,
    },
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminReason: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable ledger
  }
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('WalletTransaction', walletTransactionSchema);

