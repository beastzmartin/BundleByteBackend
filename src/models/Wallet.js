import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Balance stored in integer minor units (paise / cents) to prevent float rounding errors
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Wallet balance cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    totalAdded: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    totalCashback: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for major units (e.g. rupees or dollars)
walletSchema.virtual('balanceMajor').get(function () {
  return (this.balance / 100).toFixed(2);
});

export default mongoose.model('Wallet', walletSchema);

