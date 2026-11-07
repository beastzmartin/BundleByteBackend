import mongoose from 'mongoose';

export const SUPPORT_CATEGORIES = [
  'General Inquiry',
  'Product Inquiry',
  'Payment Issue',
  'Order Issue',
  'Product Not Delivered',
  'Invalid Account Credentials',
  'License Key Problem',
  'Subscription and Renewal',
  'Refund Request',
  'Wallet Issue',
  'Login and Registration',
  'Technical Problem',
  'Other',
];

export const TICKET_STATUSES = [
  'new',
  'open',
  'assigned',
  'in_progress',
  'waiting_for_customer',
  'waiting_for_internal_team',
  'escalated',
  'resolved',
  'closed',
];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const ticketMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null for guest messages
  },
  senderRole: {
    type: String,
    enum: ['customer', 'guest', 'admin', 'manager', 'support_agent', 'system'],
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
  isInternal: {
    type: Boolean,
    default: false, // Internal notes are hidden from customers & guests
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
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
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      tokenHash: { type: String, default: null, index: true }, // SHA-256 hashed secret token for guest access
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
    ticketType: {
      type: String,
      enum: ['order_support', 'product_inquiry', 'general_support'],
      default: 'general_support',
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General Inquiry',
      index: true,
    },
    priority: {
      type: String,
      enum: TICKET_PRIORITIES,
      default: 'normal',
      index: true,
    },
    status: {
      type: String,
      enum: TICKET_STATUSES,
      default: 'new',
      index: true,
    },
    assignedTo: {
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
    linkedConversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatConversation',
      default: null,
      index: true,
    },
    // SLA Tracking
    firstResponseDueAt: {
      type: Date,
      default: null,
    },
    firstResponseAt: {
      type: Date,
      default: null,
    },
    resolutionDueAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    slaStatus: {
      type: String,
      enum: ['within_sla', 'breaching_soon', 'breached'],
      default: 'within_sla',
      index: true,
    },
    isEscalated: {
      type: Boolean,
      default: false,
      index: true,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    escalatedReason: {
      type: String,
      default: '',
    },
    internalNotes: {
      type: String,
      default: '', // Strictly internal to staff
    },
    resolutionNotes: {
      type: String,
      default: '',
    },
    customerRating: {
      score: { type: Number, min: 1, max: 5, default: null },
      feedback: { type: String, default: '' },
      ratedAt: { type: Date, default: null },
    },
    unreadByCustomerCount: {
      type: Number,
      default: 0,
    },
    unreadByAdminCount: {
      type: Number,
      default: 0,
    },
    messages: [ticketMessageSchema],
    activityLog: [
      {
        action: { type: String, required: true },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        actorName: { type: String, default: 'System' },
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for high performance queue filtering & search
supportTicketSchema.index({ status: 1, priority: 1, department: 1, assignedTo: 1 });
supportTicketSchema.index({ createdAt: -1 });

export default mongoose.model('SupportTicket', supportTicketSchema);
