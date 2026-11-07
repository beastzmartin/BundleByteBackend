import mongoose from 'mongoose';

const amountBracketSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true, default: 0 },
    max: { type: Number, required: true, default: 999999 },
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaytmMerchant',
      required: true,
    },
    label: { type: String, default: '' },
  },
  { _id: true }
);

const merchantRoutingConfigSchema = new mongoose.Schema(
  {
    routingStrategy: {
      type: String,
      enum: ['round_robin', 'priority', 'least_used', 'manual', 'amount_based', 'failover'],
      default: 'round_robin',
    },
    manualMerchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaytmMerchant',
      default: null,
    },
    amountBrackets: [amountBracketSchema],
    failoverOrder: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaytmMerchant',
      },
    ],
    enableAutomaticFailover: {
      type: Boolean,
      default: true,
    },
    roundRobinIndex: {
      type: Number,
      default: 0,
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

export default mongoose.model('MerchantRoutingConfig', merchantRoutingConfigSchema);

