import mongoose from 'mongoose';

const approvalWorkflowSchema = new mongoose.Schema(
  {
    workflowType: {
      type: String,
      required: true,
      unique: true,
      enum: ['refund_threshold', 'wallet_adjustment', 'gateway_credential', 'role_escalation'],
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    thresholdAmount: {
      type: Number,
      default: 0, // e.g. 500 => any refund >= 500 requires approval
    },
    currency: {
      type: String,
      default: 'USD',
    },
    requiresApproval: {
      type: Boolean,
      default: true,
    },
    allowedApproverRoles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TeamRole',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('ApprovalWorkflow', approvalWorkflowSchema);

