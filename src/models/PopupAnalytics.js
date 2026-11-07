import mongoose from 'mongoose';

const popupAnalyticsSchema = new mongoose.Schema(
  {
    popup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Popup',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ['impression', 'unique_impression', 'click', 'close', 'conversion', 'coupon_copy'],
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    visitorId: {
      type: String,
      default: '',
      index: true,
    },
    pageUrl: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

popupAnalyticsSchema.index({ popup: 1, eventType: 1, createdAt: -1 });

export default mongoose.model('PopupAnalytics', popupAnalyticsSchema);

