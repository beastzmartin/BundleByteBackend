import mongoose from 'mongoose';

const taxAuditLogSchema = new mongoose.Schema(
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
      default: 'admin',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['TaxConfiguration', 'TaxCategory', 'GatewayFeeConfig', 'OrderTax', 'RefundTax'],
      required: true,
    },
    entityId: {
      type: String,
      default: '',
    },
    previousValues: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValues: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

taxAuditLogSchema.index({ createdAt: -1 });

export default mongoose.model('TaxAuditLog', taxAuditLogSchema);
