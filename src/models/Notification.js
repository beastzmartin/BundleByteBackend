import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    subtitle: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['order', 'delivery', 'subscription', 'system', 'promo', 'account', 'wallet', 'ticket', 'security'],
      default: 'system',
      index: true,
    },
    link: {
      type: String,
      default: '',
    },
    icon: {
      type: String,
      default: '',
    },
    badge: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    actions: [
      {
        action: String,
        title: String,
        icon: String,
        url: String,
      },
    ],
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    isPushSent: {
      type: Boolean,
      default: false,
    },
    pushDeliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'not_applicable'],
      default: 'pending',
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Helpful index for fast unread queries per user
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
