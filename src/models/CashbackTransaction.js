import mongoose from 'mongoose';

const cashbackTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    amount: {
      type: Number,
      required: true, // minor units (paise)
    },
    rule: {
      type: String,
      default: 'Standard Purchase Cashback',
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['credited', 'expired', 'revoked'],
      default: 'credited',
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('CashbackTransaction', cashbackTransactionSchema);

