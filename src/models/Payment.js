import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: false,
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    gateway: {
      type: String,
      enum: ['mock', 'stripe', 'paypal', 'crypto', 'binance', 'upi', 'paytm', 'wallet', 'wallet_split'],
      default: 'mock',
    },
    status: {
      type: String,
      enum: ['initiated', 'pending', 'success', 'failed', 'refunded'],
      default: 'initiated',
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    gatewayReference: {
      type: String,
      default: '',
    },
    webhookEvents: [
      {
        receivedAt: { type: Date, default: Date.now },
        eventName: String,
        payload: mongoose.Schema.Types.Mixed,
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Payment', paymentSchema);

