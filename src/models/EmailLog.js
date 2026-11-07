import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
  {
    recipient: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    recipientName: {
      type: String,
      default: '',
    },
    templateKey: {
      type: String,
      default: 'custom',
      index: true,
    },
    category: {
      type: String,
      enum: ['auth', 'order', 'finance', 'delivery', 'support', 'marketing', 'system', 'custom'],
      default: 'system',
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
      index: true,
    },
    deliveryNotification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryNotification',
      default: null,
    },
    idempotencyKey: {
      type: String,
      default: '',
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      enum: ['smtp', 'resend', 'simulation'],
      default: 'smtp',
    },
    status: {
      type: String,
      enum: ['queued', 'sending', 'sent', 'failed', 'retrying'],
      default: 'queued',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastError: {
      type: String,
      default: '',
    },
    htmlContent: {
      type: String,
      default: '',
    },
    textContent: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    messageId: {
      type: String,
      default: '',
    },
    sentAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

emailLogSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('EmailLog', emailLogSchema);
