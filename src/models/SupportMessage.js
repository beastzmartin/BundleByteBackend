import mongoose from 'mongoose';

const supportMessageSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['customer', 'admin', 'manager', 'agent'],
      default: 'customer',
    },
    senderName: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    attachments: [String],
    isInternalNote: {
      type: Boolean,
      default: false,
      index: true, // Internal staff-only notes
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('SupportMessage', supportMessageSchema);

