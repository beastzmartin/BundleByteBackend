import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatConversation',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null for guest messages
    },
    senderType: {
      type: String,
      enum: ['customer', 'guest', 'agent', 'system'],
      default: 'customer',
      index: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    attachments: [
      {
        url: { type: String, required: true },
        name: { type: String, default: '' },
        size: { type: Number, default: 0 },
        mimeType: { type: String, default: 'image/png' },
      },
    ],
    isInternalNote: {
      type: Boolean,
      default: false,
      index: true, // Internal staff-only note, hidden from customer
    },
    isReadByCustomer: {
      type: Boolean,
      default: false,
    },
    isReadByStaff: {
      type: Boolean,
      default: false,
    },
    messageType: {
      type: String,
      enum: ['text', 'attachment', 'system', 'event', 'note'],
      default: 'text',
    },
  },
  {
    timestamps: true,
  }
);

chatMessageSchema.index({ conversation: 1, createdAt: 1 });

export default mongoose.model('ChatMessage', chatMessageSchema);
