import mongoose from 'mongoose';

const pricingTierSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    originalPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const customPlanSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // e.g. "24_hours", "7_days", or a unique plan slug
    name: { type: String, required: true }, // e.g. "24 Hours Access", "7 Days VIP Trial"
    durationValue: { type: Number, required: true, default: 24 }, // e.g. 24, 7, 3
    durationUnit: {
      type: String,
      enum: ['hours', 'days', 'weeks', 'months', 'years'],
      default: 'days',
    },
    price: { type: Number, required: true, default: 0 },
    originalPrice: { type: Number, default: 0 },
    badge: { type: String, default: '' }, // e.g. "TRIAL", "POPULAR", "24H PASS"
    description: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide product title'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    summary: {
      type: String,
      required: [true, 'Please provide a short summary'],
      maxlength: [300, 'Summary cannot exceed 300 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please provide full description'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    subCategory: {
      type: String,
      default: '',
    },
    logo: {
      type: String,
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    // Badges & flags
    isFeatured: { type: Boolean, default: false, index: true },
    isTrending: { type: Boolean, default: false, index: true },
    isPopular: { type: Boolean, default: false, index: true },
    isSpecialOffer: { type: Boolean, default: false, index: true },
    badge: { type: String, default: '' }, // e.g. "HOT", "BESTSELLER", "SAVE 40%"

    // Delivery settings
    deliveryType: {
      type: String,
      enum: [
        'instant_automated',
        'admin_assisted',
        'automatic_account',
        'automatic_license',
        'manual_admin',
        'whatsapp_manual',
        'access_link',
        'license_key',
        'account_credentials',
        'activation_code',
      ],
      default: 'instant_automated',
    },
    deliveryMethod: {
      type: String,
      enum: ['automatic', 'manual', 'hybrid', 'whatsapp_manual'],
      default: 'automatic',
      index: true,
    },
    // WhatsApp Manual Delivery configuration
    whatsappConfig: {
      businessPhone: { type: String, default: '+919876543210' },
      messageTemplate: {
        type: String,
        default:
          'Hello! I have completed my purchase. Order ID: #{orderId} Product: {productTitle} Payment Status: {paymentStatus}. Please assist me with my product delivery. Thank you!',
      },
      buttonText: { type: String, default: 'Contact Us on WhatsApp' },
      expectedDeliveryTime: { type: String, default: '15-30 minutes' },
      instructions: {
        type: String,
        default: 'Click the button below to open WhatsApp with your pre-filled order reference for concierge fulfillment.',
      },
    },
    // Account requirements configuration
    accountFieldConfig: {
      requireAccountType: { type: Boolean, default: false },
      requirePlan: { type: Boolean, default: false },
      requireExpiresAt: { type: Boolean, default: false },
      requireLoginUrl: { type: Boolean, default: false },
      requireNotes: { type: Boolean, default: false },
    },
    outOfStockBehavior: {
      type: String,
      enum: ['fallback_to_manual', 'reject'],
      default: 'fallback_to_manual',
    },
    maxKeysPerOrder: {
      type: Number,
      default: 10,
      min: 1,
    },
    keyVisibilitySettings: {
      type: String,
      enum: ['always_visible', 'reveal_on_click', 'timed_expiry'],
      default: 'reveal_on_click',
    },
    deliveryEmailTemplate: {
      type: String,
      default: 'standard_digital_delivery',
    },
    keyExpiryDays: {
      type: Number,
      default: 365, // default 1 year or 0 for lifetime
    },
    deliveryInstructions: {
      type: String,
      default: 'Your license details or access instructions will be available immediately in your dashboard after payment confirmation.',
    },
    // Post-purchase only instructions and merchant notes (hidden before purchase)
    activationProcess: {
      type: String,
      default: '',
    },
    orderNote: {
      type: String,
      default: '',
    },
    activationSteps: [
      {
        stepNumber: { type: Number },
        title: { type: String },
        instruction: { type: String },
      },
    ],
    refundPolicy: {
      type: String,
      default: '14-day replacement guarantee if the license key or account fails to activate.',
    },
    termsAndConditions: {
      type: String,
      default: 'Authorized digital distribution under standard commercial license terms.',
    },

    // Specifications & features
    features: {
      type: [String],
      default: [],
    },
    specifications: [
      {
        key: { type: String },
        value: { type: String },
      },
    ],
    systemRequirements: {
      type: [String],
      default: [],
    },

    // Pricing across subscription durations
    pricing: {
      monthly: { type: pricingTierSchema, default: () => ({ enabled: true, price: 19.99, originalPrice: 29.99 }) },
      quarterly: { type: pricingTierSchema, default: () => ({ enabled: false, price: 49.99, originalPrice: 79.99 }) },
      half_yearly: { type: pricingTierSchema, default: () => ({ enabled: false, price: 89.99, originalPrice: 139.99 }) },
      annual: { type: pricingTierSchema, default: () => ({ enabled: true, price: 149.99, originalPrice: 239.99 }) },
      lifetime: { type: pricingTierSchema, default: () => ({ enabled: false, price: 299.99, originalPrice: 499.99 }) },
    },
    // Custom validity plans (e.g. 12 Hours, 24 Hours, 3 Days, 7 Days, etc.)
    customPlans: {
      type: [customPlanSchema],
      default: [],
    },
    defaultDuration: {
      type: String,
      default: 'annual',
    },

    // GST & Tax Classification
    hsnSacCode: {
      type: String,
      default: '998434', // SAC 998434: Software downloads & digital services
      trim: true,
    },
    gstRate: {
      type: Number,
      default: -1, // -1 inherits system default GST rate, or 0, 5, 12, 18, 28
    },
    taxInclusive: {
      type: Boolean,
      default: false,
    },
    taxCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxCategory',
      default: null,
    },

    // Stock & Status
    stockCount: {
      type: Number,
      default: -1, // -1 means unlimited / dynamically fulfilled
    },
    status: {
      type: String,
      enum: ['active', 'draft', 'out_of_stock', 'archived'],
      default: 'active',
      index: true,
    },

    // Metrics
    averageRating: {
      type: Number,
      default: 5.0,
      min: 1,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    salesCount: {
      type: Number,
      default: 0,
    },

    // Setup / Access link details
    defaultAccessLink: {
      type: String,
      default: '',
    },
    setupGuideUrl: {
      type: String,
      default: '',
    },
    // SEO Settings
    seoSettings: {
      metaTitle: { type: String, default: '' },
      metaDescription: { type: String, default: '' },
      keywords: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ title: 'text', summary: 'text', tags: 'text' });

export default mongoose.model('Product', productSchema);

