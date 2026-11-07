import mongoose from 'mongoose';

const chatConversationSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    isGuest: {
      type: Boolean,
      default: false,
      index: true,
    },
    guestInfo: {
      sessionId: { type: String, default: '' },
      name: { type: String, default: 'Guest Visitor' },
      email: { type: String, default: '' },
      tokenHash: { type: String, default: null, index: true },
    },
    status: {
      type: String,
      enum: ['active', 'waiting_agent', 'assigned', 'resolved', 'closed', 'converted_to_ticket'],
      default: 'waiting_agent',
      index: true,
    },
    category: {
      type: String,
      default: 'General Inquiry',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    relatedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    lastMessage: {
      text: { type: String, default: '' },
      senderRole: { type: String, default: 'customer' },
      timestamp: { type: Date, default: Date.now },
    },
    unreadCustomerCount: {
      type: Number,
      default: 0,
    },
    unreadStaffCount: {
      type: Number,
      default: 0,
    },
    convertedTicket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket',
      default: null,
      index: true,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
    convertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    customerRating: {
      score: { type: Number, min: 1, max: 5, default: null },
      feedback: { type: String, default: '' },
      ratedAt: { type: Date, default: null },
    },
    isCustomerOnline: {
      type: Boolean,
      default: false,
    },
    lastCustomerSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

chatConversationSchema.index({ status: 1, assignedAgent: 1, department: 1 });
chatConversationSchema.index({ lastActivityAt: -1 });

export default mongoose.model('ChatConversation', chatConversationSchema);
