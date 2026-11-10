import mongoose from 'mongoose';

export const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productTitle: { type: String, required: true },
  productLogo: { type: String, default: '' },
  productCategoryName: { type: String, default: '' },
  duration: {
    type: String,
    enum: ['monthly', 'quarterly', 'half_yearly', 'annual', 'lifetime'],
    required: true,
  },
  variantName: { type: String, default: 'Standard' },
  unitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, default: 1 },
  totalPrice: { type: Number, required: true },
  deliveryType: {
    type: String,
    enum: [
      'instant_automated',
      'admin_assisted',
      'account_credentials',
      'license_key',
      'activation_code',
      'access_link',
      'whatsapp_manual',
    ],
    default: 'instant_automated',
  },
  deliveryMethod: {
    type: String,
    enum: ['automatic', 'manual', 'hybrid', 'whatsapp_manual'],
    default: 'automatic',
  },
  deliveryStatus: {
    type: String,
    enum: ['pending', 'manual_queue', 'awaiting_whatsapp_contact', 'delivered', 'failed'],
    default: 'pending',
  },
  allocatedKeys: {
    type: [String],
    default: [],
  },
  allocatedAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountInventory',
    default: null,
  },
  digitalDeliveryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DigitalDelivery',
    default: null,
  },
  // Post-purchase customer instructions & notes
  activationProcess: {
    type: String,
    default: '',
  },
  orderNote: {
    type: String,
    default: '',
  },
  setupGuideUrl: {
    type: String,
    default: '',
  },
  accessLink: {
    type: String,
    default: '',
  },
  // Item GST attributes
  hsnSac: {
    type: String,
    default: '998434',
  },
  taxRate: {
    type: Number,
    default: 18,
  },
  taxableAmount: {
    type: Number,
    default: 0,
  },
  cgst: {
    type: Number,
    default: 0,
  },
  sgst: {
    type: Number,
    default: 0,
  },
  igst: {
    type: Number,
    default: 0,
  },
  itemTaxAmount: {
    type: Number,
    default: 0,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
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
    customerEmail: {
      type: String,
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    couponCode: {
      type: String,
      default: '',
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    // Centralized GST Snapshot
    taxDetails: {
      gstin: { type: String, default: '' },
      businessName: { type: String, default: '' },
      businessState: { type: String, default: 'Karnataka' },
      businessStateCode: { type: String, default: '29' },
      customerState: { type: String, default: '' },
      customerStateCode: { type: String, default: '' },
      placeOfSupply: { type: String, default: '' },
      isIntraState: { type: Boolean, default: false },
      taxMode: { type: String, enum: ['exclusive', 'inclusive'], default: 'exclusive' },
      taxableAmount: { type: Number, default: 0 },
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
      totalTax: { type: Number, default: 0 },
      isExempt: { type: Boolean, default: false },
      hsnSacSummary: [
        {
          hsnSac: String,
          taxableAmount: Number,
          rate: Number,
          cgst: Number,
          sgst: Number,
          igst: Number,
          totalTax: Number,
        },
      ],
    },
    // Gateway Fee Snapshot
    gatewayFeeDetails: {
      gatewayKey: { type: String, default: '' },
      gatewayName: { type: String, default: '' },
      feePayer: { type: String, enum: ['merchant_absorb', 'customer_pay'], default: 'merchant_absorb' },
      baseFee: { type: Number, default: 0 },
      feeGst: { type: Number, default: 0 },
      totalFee: { type: Number, default: 0 },
      customerSurcharge: { type: Number, default: 0 },
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    // Dual Currency Snapshot
    baseCurrency: {
      type: String,
      default: 'INR',
    },
    baseAmount: {
      type: Number,
      default: 0,
    },
    customerCurrency: {
      type: String,
      default: 'INR',
    },
    customerAmount: {
      type: Number,
      default: 0,
    },
    exchangeRate: {
      type: Number,
      default: 1.0,
    },
    conversionMarginAmount: {
      type: Number,
      default: 0,
    },
    gatewayFeeAmount: {
      type: Number,
      default: 0,
    },
    processingCurrency: {
      type: String,
      default: 'INR',
    },
    processingAmount: {
      type: Number,
      default: 0,
    },
    currencyQuoteId: {
      type: String,
      default: '',
    },
    paymentMethod: {
      type: String,
      enum: ['mock', 'stripe', 'paypal', 'crypto', 'binance', 'upi', 'paytm', 'wallet', 'wallet_split'],
      default: 'mock',
    },
    walletAmountUsed: {
      type: Number,
      default: 0,
    },
    walletAmountPaise: {
      type: Number,
      default: 0,
    },
    gatewayAmountPaid: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ['processing', 'completed', 'delivered', 'cancelled', 'refunded'],
      default: 'processing',
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'delivering', 'manual_queue', 'awaiting_whatsapp_contact', 'delivered', 'action_required'],
      default: 'pending',
      index: true,
    },
    paymentDetails: {
      transactionId: { type: String, default: '' },
      gateway: { type: String, default: 'mock' },
      paidAt: { type: Date },
      receiptUrl: { type: String, default: '' },
    },
    billingAddress: {
      company: String,
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    notes: {
      type: String,
      default: '',
    },
    adminOrderNote: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const OrderItem = mongoose.model('OrderItem', orderItemSchema);
export default mongoose.model('Order', orderSchema);

