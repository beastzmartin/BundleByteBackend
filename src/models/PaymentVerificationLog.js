import mongoose from 'mongoose';

const paymentVerificationLogSchema = new mongoose.Schema(
  {
    paymentAttempt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentAttempt',
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    source: {
      type: String,
      enum: ['polling', 'callback', 'webhook', 'cron', 'admin_manual'],
      required: true,
    },
    requestPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    verifiedStatus: {
      type: String,
      required: true,
    },
    verifiedAmount: {
      type: Number,
      default: null,
    },
    paytmTxnId: {
      type: String,
      default: '',
    },
    bankTxnId: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('PaymentVerificationLog', paymentVerificationLogSchema);

