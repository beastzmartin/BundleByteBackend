import mongoose from 'mongoose';

const trustedPaymentRecordSchema = new mongoose.Schema(
  {
    paymentType: {
      type: String,
      enum: ['upi_utr', 'binance_usdt', 'bank_transfer'],
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    senderVpaOrAddress: {
      type: String,
      default: '',
    },
    senderName: {
      type: String,
      default: '',
    },
    receiverVpaOrAddress: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['credited', 'settled', 'failed'],
      default: 'credited',
      index: true,
    },
    settledAt: {
      type: Date,
      default: Date.now,
    },
    isClaimed: {
      type: Boolean,
      default: false,
      index: true,
    },
    claimedByOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    claimedByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    rawBankPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('TrustedPaymentRecord', trustedPaymentRecordSchema);

