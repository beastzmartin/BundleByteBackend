import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productTitle: { type: String, required: true },
  productLogo: { type: String, default: '' },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  deliveryType: { type: String, default: 'instant_automated' },
  duration: { type: String, default: 'annual' },
  planName: { type: String, default: '' },
  validityText: { type: String, default: '' },
  accessExpiresAt: { type: Date, default: null },
  durationValue: { type: Number, default: 0 },
  durationUnit: { type: String, default: '' },
  isLifetime: { type: Boolean, default: false },
  productAccessLink: { type: String, default: '' },
  setupGuideUrl: { type: String, default: '' },
  vaultUrl: { type: String, default: '' },
  licenseKey: { type: String, default: '' },
  activationSteps: { type: String, default: '' },
  // GST breakdown for this item
  hsnSac: { type: String, default: '998434' },
  taxRate: { type: Number, default: 18 },
  taxableAmount: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
});

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerEmail: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    billingAddress: {
      company: { type: String, default: '' },
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zipCode: { type: String, default: '' },
      country: { type: String, default: 'India' },
      taxId: { type: String, default: '' },
    },
    items: [invoiceItemSchema],
    financialSnapshot: {
      subtotal: { type: Number, required: true, default: 0 },
      taxableAmount: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      couponDiscount: { type: Number, default: 0 },
      couponCode: { type: String, default: '' },
      walletAmountUsed: { type: Number, default: 0 },
      gatewayAmountPaid: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      taxRate: { type: Number, default: 0 },
      taxType: { type: String, default: 'GST' },
      taxMode: { type: String, enum: ['exclusive', 'inclusive'], default: 'exclusive' },
      placeOfSupply: { type: String, default: 'Karnataka' },
      placeOfSupplyCode: { type: String, default: '29' },
      isIntraState: { type: Boolean, default: false },
      taxBreakdown: {
        cgst: { type: Number, default: 0 },
        sgst: { type: Number, default: 0 },
        igst: { type: Number, default: 0 },
      },
      gatewayFeeDetails: {
        gatewayKey: { type: String, default: '' },
        gatewayName: { type: String, default: '' },
        feePayer: { type: String, enum: ['merchant_absorb', 'customer_pay'], default: 'merchant_absorb' },
        baseFee: { type: Number, default: 0 },
        feeGst: { type: Number, default: 0 },
        totalFee: { type: Number, default: 0 },
        customerSurcharge: { type: Number, default: 0 },
      },
      additionalCharges: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true, default: 0 },
      currency: { type: String, default: 'INR' },
    },
    paymentDetails: {
      paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'partially_refunded'],
        default: 'paid',
        index: true,
      },
      paymentMethod: { type: String, default: 'mock' },
      transactionId: { type: String, default: '' },
      paidAt: { type: Date, default: Date.now },
      gateway: { type: String, default: '' },
    },
    businessInfo: {
      companyName: { type: String, default: 'BundleByte Technologies Pvt Ltd' },
      companyLogo: { type: String, default: '' },
      businessAddress: { type: String, default: '100 Innovation Boulevard, Tech Park, Bangalore 560001' },
      emailAddress: { type: String, default: 'billing@bundlebyte.com' },
      contactPhone: { type: String, default: '+91 80 4000 1234' },
      gstin: { type: String, default: '29ABCDE1234F1Z5' },
      websiteUrl: { type: String, default: 'https://bundlebyte.com' },
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    dueDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['issued', 'paid', 'cancelled', 'refunded'],
      default: 'issued',
      index: true,
    },
    creditNote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CreditNote',
      default: null,
    },
    creditNoteIssued: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: 'Thank you for your business. Digital goods are delivered into your customer vault.',
    },
    terms: {
      type: String,
      default: 'Digital product sales are subject to our terms of service and standard refund policy.',
    },
    showWarrantySection: {
      type: Boolean,
      default: true,
    },
    warrantyText: {
      type: String,
      default: 'Includes Official 14-Day Replacement Warranty • 24/7 Concierge Support',
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    lastDownloadedAt: {
      type: Date,
      default: null,
    },
    idempotencyKey: {
      type: String,
      default: '',
      index: true,
    },
    invoiceConfigSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ createdAt: -1 });

export default mongoose.model('Invoice', invoiceSchema);
