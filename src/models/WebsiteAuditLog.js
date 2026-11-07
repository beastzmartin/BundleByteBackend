import mongoose from 'mongoose';

const websiteAuditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorEmail: {
      type: String,
      default: 'system',
    },
    actorRole: {
      type: String,
      default: 'system',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    module: {
      type: String,
      enum: [
        'branding',
        'theme',
        'homepage',
        'navigation',
        'footer',
        'popup',
        'announcement',
        'banner',
        'seo',
        'page',
        'publishing',
        'permissions',
      ],
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

websiteAuditLogSchema.index({ module: 1, createdAt: -1 });

export default mongoose.model('WebsiteAuditLog', websiteAuditLogSchema);

