import mongoose from 'mongoose';

const paymentAttemptSchema = new mongoose.Schema(
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
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaytmMerchant',
      required: true,
      index: true,
    },
    merchantName: {
      type: String,
      required: true,
    },
    paytmMid: {
      type: String,
      required: true,
      index: true,
    },
    merchantOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paytmTxnRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paytmRemark: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    upiUri: {
      type: String,
      required: true,
    },
    paytmIntentUri: {
      type: String,
      required: true,
    },
    qrCodeUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['PENDING', 'TXN_SUCCESS', 'TXN_FAILURE', 'EXPIRED', 'CANCELLED'],
      default: 'PENDING',
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
    gatewayName: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationSource: {
      type: String,
      enum: ['polling', 'callback', 'webhook', 'cron', 'admin_manual', 'none'],
      default: 'none',
    },
    isWalletTopup: {
      type: Boolean,
      default: false,
    },
    walletTopupRef: {
      type: String,
      default: '',
    },
    callbackPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('PaymentAttempt', paymentAttemptSchema);

