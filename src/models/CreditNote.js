import mongoose from 'mongoose';

const creditNoteSchema = new mongoose.Schema(
  {
    creditNoteNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Refund',
      default: null,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    originalInvoiceNumber: {
      type: String,
      required: true,
    },
    refundAmount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    reason: {
      type: String,
      default: 'Customer requested refund / product cancellation',
    },
    items: [
      {
        productTitle: String,
        quantity: Number,
        unitPrice: Number,
        refundedAmount: Number,
      },
    ],
    status: {
      type: String,
      enum: ['issued', 'applied'],
      default: 'issued',
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    businessInfo: {
      companyName: { type: String, default: 'BundleByte Technologies Pvt Ltd' },
      businessAddress: { type: String, default: '100 Innovation Boulevard, Tech Park, Bangalore 560001' },
      emailAddress: { type: String, default: 'billing@bundlebyte.com' },
      gstin: { type: String, default: '29ABCDE1234F1Z5' },
    },
  },
  {
    timestamps: true,
  }
);

creditNoteSchema.index({ createdAt: -1 });

export default mongoose.model('CreditNote', creditNoteSchema);
