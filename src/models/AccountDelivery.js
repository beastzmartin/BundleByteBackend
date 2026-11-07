import mongoose from 'mongoose';
import { decryptCredential } from '../utils/credentialEncryption.js';

const accountDeliverySchema = new mongoose.Schema(
  {
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccountInventory',
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
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    deliveredUsername: {
      type: String,
      required: true,
    },
    encryptedPassword: {
      type: String,
      required: true,
    },
    loginUrl: {
      type: String,
      default: '',
    },
    accountType: {
      type: String,
      default: 'Premium',
    },
    plan: {
      type: String,
      default: 'Annual',
    },
    notes: {
      type: String,
      default: '',
    },
    deliveredAt: {
      type: Date,
      default: Date.now,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

accountDeliverySchema.methods.getDecryptedPassword = function () {
  return decryptCredential(this.encryptedPassword);
};

export default mongoose.model('AccountDelivery', accountDeliverySchema);

