import mongoose from 'mongoose';

const paymentVerificationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    paymentType: {
      type: String,
      enum: ['binance_usdt', 'upi_utr'],
      required: true,
      index: true,
    },
    referenceCode: {
      type: String,
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USDT',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'under_review'],
      default: 'pending',
      index: true,
    },
    verificationSource: {
      type: String,
      enum: ['binance_api_auto', 'trusted_ledger_auto', 'admin_manual', 'none'],
      default: 'none',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    rawDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    isWalletTopup: {
      type: Boolean,
      default: false,
    },
    walletAmountPaise: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

paymentVerificationSchema.index({ transactionId: 1, paymentType: 1 });
paymentVerificationSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('PaymentVerification', paymentVerificationSchema);

