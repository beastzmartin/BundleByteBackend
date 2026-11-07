import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productTitle: {
      type: String,
      required: true,
    },
    productLogo: {
      type: String,
      default: '',
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    duration: {
      type: String,
      enum: ['monthly', 'quarterly', 'half_yearly', 'annual', 'lifetime'],
      required: true,
    },
    billingCyclePrice: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    isLifetime: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'expiring_soon', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    renewalCount: {
      type: Number,
      default: 0,
    },
    lastReminderSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Subscription', subscriptionSchema);

