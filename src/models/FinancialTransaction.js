import mongoose from 'mongoose';

const financialTransactionSchema = new mongoose.Schema(
  {
    transactionReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['order_payment', 'wallet_topup', 'wallet_payment', 'refund', 'margin_earned', 'gateway_charge'],
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    paymentGateway: {
      type: String,
      required: true,
      index: true,
    },
    gatewayTransactionId: {
      type: String,
      default: '',
    },
    // Base Currency breakdown (Internal Accounting)
    baseCurrency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'INR',
    },
    baseAmount: {
      type: Number,
      required: true,
    },
    baseNetRevenue: {
      type: Number,
      required: true,
    },
    // Customer Currency breakdown
    customerCurrency: {
      type: String,
      required: true,
      uppercase: true,
    },
    customerAmount: {
      type: Number,
      required: true,
    },
    // Processing Currency breakdown
    processingCurrency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'INR',
    },
    processingAmount: {
      type: Number,
      required: true,
    },
    // Financial margins & fees
    exchangeRate: {
      type: Number,
      required: true,
    },
    conversionMarginPercentage: {
      type: Number,
      default: 0,
    },
    conversionMarginEarnedBase: {
      type: Number,
      default: 0,
    },
    gatewayFeeBase: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['settled', 'pending', 'refunded', 'failed'],
      default: 'settled',
      index: true,
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

financialTransactionSchema.index({ customerCurrency: 1, createdAt: -1 });
financialTransactionSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model('FinancialTransaction', financialTransactionSchema);

