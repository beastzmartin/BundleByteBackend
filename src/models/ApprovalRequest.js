import mongoose from 'mongoose';

const approvalRequestSchema = new mongoose.Schema(
  {
    workflowType: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    targetEntity: {
      type: String,
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      default: '',
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      default: '',
      trim: true,
    },
    appliedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('ApprovalRequest', approvalRequestSchema);

