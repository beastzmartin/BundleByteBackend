import mongoose from 'mongoose';
import { encryptCredential, decryptCredential } from '../utils/credentialEncryption.js';

const accountInventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Associated product is required'],
      index: true,
    },
    username: {
      type: String,
      required: [true, 'Account username or email is required'],
      trim: true,
      index: true,
    },
    // Encrypted password at rest
    encryptedPassword: {
      type: String,
      required: [true, 'Account password is required'],
    },
    accountType: {
      type: String,
      default: 'Premium', // e.g. Premium, Business, Enterprise, Individual
    },
    plan: {
      type: String,
      default: 'Annual', // e.g. Monthly, Quarterly, Annual, Lifetime
    },
    loginUrl: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Available', 'Reserved', 'Sold', 'Disabled', 'Expired'],
      default: 'Available',
      index: true,
    },
    allocatedToOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    allocatedToUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    allocatedAt: {
      type: Date,
      default: null,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccountImportBatch',
      default: null,
    },
    batchTag: {
      type: String,
      default: '',
    },
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

accountInventorySchema.index({ product: 1, status: 1 });
accountInventorySchema.index({ product: 1, username: 1 });

// Helper instance method to safely decrypt password
accountInventorySchema.methods.getDecryptedPassword = function () {
  return decryptCredential(this.encryptedPassword);
};

// Static helper to create account with automatic password encryption
accountInventorySchema.statics.createEncrypted = async function (data) {
  const plainPassword = data.plainPassword || data.password || data.encryptedPassword;
  if (!plainPassword) {
    throw new Error('Account password is required');
  }
  const encryptedPassword = encryptCredential(plainPassword);

  const docData = { ...data };
  delete docData.plainPassword;
  delete docData.password;

  return this.create({
    ...docData,
    encryptedPassword,
  });
};

export default mongoose.model('AccountInventory', accountInventorySchema);
