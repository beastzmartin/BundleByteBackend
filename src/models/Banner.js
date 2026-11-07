import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    bannerType: {
      type: String,
      enum: ['promotional', 'product_specific', 'category_specific', 'info_alert'],
      default: 'promotional',
      index: true,
    },
    placement: {
      type: String,
      enum: [
        'homepage_hero_bottom',
        'homepage_mid',
        'product_list_top',
        'category_header',
        'cart_drawer',
        'checkout_sidebar',
      ],
      default: 'homepage_mid',
      required: true,
      index: true,
    },
    desktopImage: {
      type: String,
      required: true,
    },
    mobileImage: {
      type: String,
      default: '', // Falls back to desktopImage if not provided
    },
    targetUrl: {
      type: String,
      default: '/products',
      trim: true,
    },
    openInNewTab: {
      type: Boolean,
      default: false,
    },
    ctaButton: {
      enabled: { type: Boolean, default: true },
      text: { type: String, default: 'Explore Deal' },
      style: { type: String, default: 'primary' }, // primary, white, outline
    },
    headline: {
      type: String,
      default: '',
    },
    subheadline: {
      type: String,
      default: '',
    },
    badgeText: {
      type: String,
      default: '',
    },
    targetProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    targetCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    analytics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
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

// Method to verify if active
bannerSchema.methods.isActive = function () {
  if (this.status !== 'published') return false;
  const now = new Date();
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  return true;
};

export default mongoose.model('Banner', bannerSchema);

