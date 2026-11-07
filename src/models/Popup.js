import mongoose from 'mongoose';

const popupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    popupType: {
      type: String,
      enum: [
        'promotional',
        'welcome',
        'discount_coupon',
        'login_register',
        'maintenance',
        'important_notice',
        'product_promotion',
        'subscription_promotion',
        'custom_html',
      ],
      default: 'promotional',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    priority: {
      type: Number,
      default: 1, // Higher priority displays first
    },

    // Design Editor
    design: {
      title: { type: String, default: '', trim: true },
      subtitle: { type: String, default: '', trim: true },
      description: { type: String, default: '', trim: true },
      badge: { type: String, default: '', trim: true },
      image: { type: String, default: '' },
      backgroundImage: { type: String, default: '' },
      backgroundColor: { type: String, default: '#ffffff' },
      textColor: { type: String, default: '#0f172a' },
      primaryButtonText: { type: String, default: 'Learn More' },
      primaryButtonUrl: { type: String, default: '/products' },
      primaryButtonColor: { type: String, default: '#4f46e5' },
      primaryButtonTextColor: { type: String, default: '#ffffff' },
      secondaryButtonText: { type: String, default: '' },
      secondaryButtonUrl: { type: String, default: '' },
      couponCode: { type: String, default: '', trim: true },
      discountAmount: { type: String, default: '' }, // e.g. "20% OFF"
      targetProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
      customHtml: { type: String, default: '' },
      showCloseButton: { type: Boolean, default: true },
      width: { type: String, default: 'max-w-lg' }, // max-w-sm, max-w-md, max-w-lg, max-w-xl, max-w-2xl
      borderRadius: { type: String, default: 'rounded-3xl' },
      animation: {
        type: String,
        enum: ['fade', 'zoom', 'slide_up', 'slide_down', 'bounce'],
        default: 'zoom',
      },
      overlayOpacity: {
        type: String,
        enum: ['0', '25', '50', '75', '90'],
        default: '50',
      },
    },

    // Display Rules
    displayRules: {
      showOnHomepage: { type: Boolean, default: true },
      showOnProductPages: { type: Boolean, default: false },
      showOnCheckout: { type: Boolean, default: false },
      showOnLoginPage: { type: Boolean, default: false },
      showOnRegisterPage: { type: Boolean, default: false },
      selectedPages: { type: [String], default: [] }, // Custom path patterns
      showToLoggedIn: { type: Boolean, default: true },
      showToGuests: { type: Boolean, default: true },
      selectedCustomerGroups: {
        type: [String],
        enum: ['all', 'new_customers', 'repeat_buyers', 'vip'],
        default: ['all'],
      },
    },

    // Trigger Rules
    triggerRules: {
      triggerType: {
        type: String,
        enum: ['immediate', 'delay', 'exit_intent', 'scroll_percent', 'button_click'],
        default: 'delay',
      },
      delaySeconds: { type: Number, default: 3 },
      scrollPercent: { type: Number, default: 40 },
      triggerSelector: { type: String, default: '' },
      frequencyCap: {
        type: String,
        enum: ['every_visit', 'once_per_session', 'once_per_user', 'once_per_day', 'once_per_week'],
        default: 'once_per_session',
      },
    },

    // Scheduling
    scheduling: {
      isScheduled: { type: Boolean, default: false },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      timezone: { type: String, default: 'UTC' },
      autoActivate: { type: Boolean, default: true },
      autoExpire: { type: Boolean, default: true },
    },

    // Analytics Counter Rollup
    analytics: {
      impressions: { type: Number, default: 0 },
      uniqueImpressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      closeEvents: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      couponCopies: { type: Number, default: 0 },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helper check if popup is currently valid to display
popupSchema.methods.isCurrentlyActive = function () {
  if (this.status !== 'published') return false;
  if (!this.scheduling.isScheduled) return true;

  const now = new Date();
  if (this.scheduling.startDate && now < this.scheduling.startDate) return false;
  if (this.scheduling.endDate && now > this.scheduling.endDate) return false;
  return true;
};

export default mongoose.model('Popup', popupSchema);

