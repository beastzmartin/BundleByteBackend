import mongoose from 'mongoose';

const deliveryNotificationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipient: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    recipientName: {
      type: String,
      default: '',
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    deliveryType: {
      type: String,
      enum: [
        'instant_automated',
        'admin_assisted',
        'account_credentials',
        'license_key',
        'activation_code',
        'access_link',
        'whatsapp_manual',
        'multi_item',
      ],
      default: 'instant_automated',
    },
    itemsSummary: [
      {
        productTitle: String,
        deliveryType: String,
        duration: String,
        quantity: Number,
        hasSensitiveCredentials: { type: Boolean, default: false },
        setupGuideUrl: String,
        accessLink: String,
      },
    ],
    secureAccessToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
    firstAccessedAt: {
      type: Date,
      default: null,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    emailLog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailLog',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    resendCount: {
      type: Number,
      default: 0,
    },
    lastResentAt: {
      type: Date,
      default: null,
    },
    lastResentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

deliveryNotificationSchema.index({ createdAt: -1 });

export default mongoose.model('DeliveryNotification', deliveryNotificationSchema);
