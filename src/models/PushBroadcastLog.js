import mongoose from 'mongoose';

const pushBroadcastLogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    targetAudience: {
      type: String,
      enum: ['all_users', 'customers_only', 'admins_only', 'specific_user'],
      default: 'all_users',
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    category: {
      type: String,
      enum: ['promo', 'order', 'delivery', 'system', 'wallet', 'security'],
      default: 'promo',
    },
    link: {
      type: String,
      default: '/',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    iconUrl: {
      type: String,
      default: '',
    },
    actions: [
      {
        action: String,
        title: String,
        url: String,
      },
    ],
    totalSubscribersTargeted: {
      type: Number,
      default: 0,
    },
    successfulCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    expiredCleanedCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['completed', 'partial', 'failed'],
      default: 'completed',
    },
    executionTimeMs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('PushBroadcastLog', pushBroadcastLogSchema);
