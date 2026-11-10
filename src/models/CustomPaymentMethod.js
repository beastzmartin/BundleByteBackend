import mongoose from 'mongoose';

const customPaymentMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['bank_transfer', 'manual_qr', 'crypto', 'custom'],
      default: 'bank_transfer',
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    instructions: {
      type: String,
      default: '',
    },
    icon: {
      type: String,
      default: 'CreditCard',
    },
    badgeText: {
      type: String,
      default: 'Manual Verification',
    },
    qrCodeUrl: {
      type: String,
      default: '',
    },
    bankDetails: {
      accountHolderName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      bankName: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      branchName: { type: String, default: '' },
      swiftBic: { type: String, default: '' },
      iban: { type: String, default: '' },
      upiId: { type: String, default: '' },
      cryptoNetwork: { type: String, default: '' },
      walletAddress: { type: String, default: '' },
      customNotes: { type: String, default: '' },
    },
    verificationSettings: {
      requireTransactionId: { type: Boolean, default: true },
      transactionIdLabel: { type: String, default: 'Transaction Reference / UTR Number' },
      transactionIdPlaceholder: { type: String, default: 'e.g. 12-digit UTR or Bank URN' },
      requireScreenshot: { type: Boolean, default: true },
      screenshotLabel: { type: String, default: 'Payment Screenshot / Transfer Receipt' },
      requireSenderName: { type: Boolean, default: true },
      senderNameLabel: { type: String, default: 'Sender / Account Holder Name' },
      requireSenderBank: { type: Boolean, default: false },
      customFields: [
        {
          fieldKey: { type: String, required: true },
          label: { type: String, required: true },
          placeholder: { type: String, default: '' },
          fieldType: { type: String, enum: ['text', 'number'], default: 'text' },
          required: { type: Boolean, default: false },
        },
      ],
    },
    minAmount: {
      type: Number,
      default: 0,
    },
    maxAmount: {
      type: Number,
      default: 0,
    },
    currencies: {
      type: [String],
      default: ['INR', 'USD', 'ALL'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

customPaymentMethodSchema.index({ isActive: 1, displayOrder: 1 });

export default mongoose.model('CustomPaymentMethod', customPaymentMethodSchema);
