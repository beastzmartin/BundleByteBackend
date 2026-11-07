import mongoose from 'mongoose';

const emailProviderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    providerType: {
      type: String,
      enum: ['smtp', 'resend', 'simulation'],
      required: true,
      default: 'smtp',
    },
    priority: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isFallback: {
      type: Boolean,
      default: false,
    },
    senderName: {
      type: String,
      default: 'BundleByte',
    },
    senderEmail: {
      type: String,
      default: 'support@bundlebyte.com',
    },
    replyToEmail: {
      type: String,
      default: 'support@bundlebyte.com',
    },
    smtpConfig: {
      host: { type: String, default: '' },
      port: { type: Number, default: 587 },
      username: { type: String, default: '' },
      encryptedPassword: { type: String, default: '' },
      encryptionMode: {
        type: String,
        enum: ['tls', 'ssl', 'none'],
        default: 'tls',
      },
    },
    resendConfig: {
      encryptedApiKey: { type: String, default: '' },
    },
    stats: {
      totalSent: { type: Number, default: 0 },
      totalFailed: { type: Number, default: 0 },
      lastUsedAt: { type: Date, default: null },
      lastError: { type: String, default: '' },
      healthStatus: {
        type: String,
        enum: ['healthy', 'degraded', 'offline', 'untested'],
        default: 'untested',
      },
      lastPingAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

emailProviderSchema.index({ priority: 1, isActive: 1 });

export default mongoose.model('EmailProvider', emailProviderSchema);
