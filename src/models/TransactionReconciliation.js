import mongoose from 'mongoose';

const transactionReconciliationSchema = new mongoose.Schema(
  {
    paymentAttempt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentAttempt',
      required: true,
      unique: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaytmMerchant',
      required: true,
      index: true,
    },
    paytmMid: {
      type: String,
      required: true,
      index: true,
    },
    merchantOrderId: {
      type: String,
      required: true,
      index: true,
    },
    paytmTxnId: {
      type: String,
      default: '',
      index: true,
    },
    bankTxnId: {
      type: String,
      default: '',
      index: true,
    },
    expectedAmount: {
      type: Number,
      required: true,
    },
    settledAmount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['matched', 'mismatch_amount', 'unsettled', 'refunded'],
      default: 'unsettled',
      index: true,
    },
    reconciliationNotes: {
      type: String,
      default: '',
    },
    reconciledAt: {
      type: Date,
      default: null,
    },
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('TransactionReconciliation', transactionReconciliationSchema);

