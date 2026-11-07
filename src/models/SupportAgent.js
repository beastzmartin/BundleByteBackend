import mongoose from 'mongoose';

const supportAgentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    department: {
      type: String,
      default: 'General Support', // e.g. Technical, Accounts, Billing, General
    },
    assignedTicketCount: {
      type: Number,
      default: 0,
    },
    resolvedTicketCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'busy', 'offline'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('SupportAgent', supportAgentSchema);

