import mongoose from 'mongoose';

const deliveryHistorySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    digitalDelivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DigitalDelivery',
      default: null,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      enum: [
        'auto_delivered',
        'manual_delivered',
        're_delivered',
        'revoked',
        'accessed',
        'manual_queued',
        'delivered',
        'whatsapp_queued',
      ],
      default: 'auto_delivered',
      index: true,
    },
    event: {
      type: String,
      default: 'delivered',
    },
    deliveryMethod: {
      type: String,
      default: 'automatic',
    },
    orderItemIndex: {
      type: Number,
      default: 0,
    },
    auditNotes: {
      type: String,
      default: '',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performedByRole: {
      type: String,
      default: 'system',
    },
    keysDelivered: [String],
    notes: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

deliveryHistorySchema.index({ order: 1, createdAt: -1 });

export default mongoose.model('DeliveryHistory', deliveryHistorySchema);
