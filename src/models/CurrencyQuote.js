import mongoose from 'mongoose';

const quoteItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productTitle: { type: String, required: true },
    duration: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    baseUnitPrice: { type: Number, required: true },
    baseTotalPrice: { type: Number, required: true },
    customerUnitPrice: { type: Number, required: true },
    customerTotalPrice: { type: Number, required: true },
    isManualPricing: { type: Boolean, default: false },
  },
  { _id: false }
);

const currencyQuoteSchema = new mongoose.Schema(
  {
    quoteId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    items: [quoteItemSchema],
    baseCurrency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'INR',
    },
    customerCurrency: {
      type: String,
      required: true,
      uppercase: true,
    },
    processingCurrency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'INR',
    },
    exchangeRate: {
      type: Number,
      required: true, // 1 Base Currency = X Customer Currency
    },
    rateInverse: {
      type: Number,
      required: true, // 1 Customer Currency = X Base Currency
    },
    baseSubtotal: {
      type: Number,
      required: true,
    },
    baseDiscount: {
      type: Number,
      default: 0,
    },
    baseTaxAmount: {
      type: Number,
      default: 0,
    },
    baseTotal: {
      type: Number,
      required: true,
    },
    // Customer Currency figures
    customerSubtotal: {
      type: Number,
      required: true,
    },
    customerDiscount: {
      type: Number,
      default: 0,
    },
    marginPercentage: {
      type: Number,
      default: 0,
    },
    conversionMarginAmount: {
      type: Number,
      default: 0,
    },
    gatewayFee: {
      type: Number,
      default: 0,
    },
    customerTaxAmount: {
      type: Number,
      default: 0,
    },
    customerTotal: {
      type: Number,
      required: true,
    },
    // Gateway Processing Equivalent (what the actual gateway charges in its processing currency)
    processingTotal: {
      type: Number,
      required: true,
    },
    paymentGateway: {
      type: String,
      default: 'paytm',
    },
    couponCode: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-expire index (TTL can also clean up quotes after 24 hours)
currencyQuoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model('CurrencyQuote', currencyQuoteSchema);
