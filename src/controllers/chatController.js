import crypto from 'crypto';
import ChatConversation from '../models/ChatConversation.js';
import ChatMessage from '../models/ChatMessage.js';
import SupportTicket from '../models/SupportTicket.js';
import User from '../models/User.js';
import assignmentService from '../services/assignmentService.js';
import slaService from '../services/slaService.js';
import rbacService from '../services/rbacService.js';
import { getIO } from '../services/socketHandler.js';
import { SENSITIVITY_LEVELS } from '../constants/permissionsRegistry.js';

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * @desc Initiate a new live chat conversation (Registered User or Guest)
 * @route POST /api/chat/initiate
 */
export const initiateChat = async (req, res, next) => {
  try {
    const {
      guestName,
      guestEmail,
      category = 'General Inquiry',
      priority = 'normal',
      relatedOrderId,
      relatedProductId,
      departmentId,
      initialMessage,
    } = req.body;

    const conversationId = `CHAT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    let conversation;
    let rawGuestToken = null;

    if (req.user) {
      // Authenticated Registered Customer
      // Check if user already has an active ongoing conversation
      const existing = await ChatConversation.findOne({
        customer: req.user._id,
        status: { $in: ['active', 'waiting_agent', 'assigned'] },
      });

      if (existing) {
        if (initialMessage && initialMessage.trim()) {
          await ChatMessage.create({
            conversation: existing._id,
            sender: req.user._id,
            senderType: 'customer',
            senderName: req.user.name,
            message: initialMessage.trim(),
            messageType: 'text',
          });
          existing.lastMessage = {
            text: initialMessage.trim(),
            senderRole: 'customer',
            timestamp: new Date(),
          };
          existing.lastActivityAt = new Date();
          await existing.save();
        }

        return res.status(200).json({
          success: true,
          message: 'Active conversation resumed',
          conversation: existing,
          isExisting: true,
        });
      }

      // Assign an agent dynamically using workload routing
      const optimalAgent = await assignmentService.findOptimalAgent({ channel: 'chat', departmentId });

      conversation = await ChatConversation.create({
        conversationId,
        customer: req.user._id,
        isGuest: false,
        category,
        priority,
        department: departmentId || null,
        assignedAgent: optimalAgent?._id || null,
        status: optimalAgent ? 'assigned' : 'waiting_agent',
        relatedOrder: relatedOrderId || null,
        relatedProduct: relatedProductId || null,
      });
    } else {
      // Guest Visitor
      if (!guestName || !guestEmail) {
        return res.status(400).json({
          success: false,
          message: 'Name and email are required to begin guest live chat.',
        });
      }

      rawGuestToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawGuestToken);

      const optimalAgent = await assignmentService.findOptimalAgent({ channel: 'chat', departmentId });

      conversation = await ChatConversation.create({
        conversationId,
        isGuest: true,
        guestInfo: {
          sessionId: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: guestName.trim(),
          email: guestEmail.toLowerCase().trim(),
          tokenHash,
        },
        category,
        priority,
        department: departmentId || null,
        assignedAgent: optimalAgent?._id || null,
        status: optimalAgent ? 'assigned' : 'waiting_agent',
        relatedOrder: relatedOrderId || null,
        relatedProduct: relatedProductId || null,
      });
    }

    // Persist initial message if provided
    if (initialMessage && initialMessage.trim()) {
      await ChatMessage.create({
        conversation: conversation._id,
        sender: req.user?._id || null,
        senderType: req.user ? 'customer' : 'guest',
        senderName: req.user ? req.user.name : guestName.trim(),
        message: initialMessage.trim(),
        messageType: 'text',
      });

      conversation.lastMessage = {
        text: initialMessage.trim(),
        senderRole: req.user ? 'customer' : 'guest',
        timestamp: new Date(),
      };
      await conversation.save();
    }

    // Notify staff room through Socket.IO
    const io = getIO();
    if (io) {
      io.to('staff:support').emit('new_conversation_created', {
        conversationId: conversation._id,
        category: conversation.category,
        customerName: req.user ? req.user.name : guestName,
        assignedAgent: conversation.assignedAgent,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Live chat initiated successfully',
      conversation,
      rawGuestToken,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Retrieve conversation details & message transcript
 * @route GET /api/chat/:id
 */
export const getChatHistory = async (req, res, next) => {
  try {
    const conversation = await ChatConversation.findById(req.params.id)
      .populate('customer', 'name email avatar role')
      .populate('assignedAgent', 'name email avatar')
      .populate('department', 'name slug')
      .populate('relatedOrder', 'orderNumber totalAmount paymentStatus')
      .populate('relatedProduct', 'title logo slug')
      .populate('convertedTicket', 'ticketNumber status');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Check authorization: staff, conversation owner, or verified guest token
    const isStaff = req.user && ['super_admin', 'admin', 'manager', 'support_agent'].includes(req.user.role);
    let authorized = false;

    if (isStaff) {
      authorized = true;
    } else if (req.user && conversation.customer && conversation.customer._id.toString() === req.user._id.toString()) {
      authorized = true;
    } else if (conversation.isGuest) {
      const guestToken = req.headers['x-guest-token'] || req.query.token;
      if (guestToken && hashToken(guestToken) === conversation.guestInfo?.tokenHash) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this conversation' });
    }

    // Filter out internal notes for customers / guests
    const messageFilter = { conversation: conversation._id };
    if (!isStaff) {
      messageFilter.isInternalNote = false;
    }

    const messages = await ChatMessage.find(messageFilter).sort({ createdAt: 1 });

    // Mark as read for caller
    if (isStaff) {
      conversation.unreadStaffCount = 0;
    } else {
      conversation.unreadCustomerCount = 0;
    }
    await conversation.save();

    return res.status(200).json({
      success: true,
      conversation,
      messages,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Send a message in a conversation (HTTP fallback for Socket.IO)
 * @route POST /api/chat/:id/messages
 */
export const sendChatMessage = async (req, res, next) => {
  try {
    const { message, attachments = [], isInternalNote = false } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const conversation = await ChatConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const isStaff = req.user && ['super_admin', 'admin', 'manager', 'support_agent'].includes(req.user.role);

    // Verify ownership / guest authorization
    let senderType = 'customer';
    let senderName = req.user?.name || conversation.guestInfo?.name || 'Customer';
    let senderId = req.user?._id || null;

    if (isStaff) {
      senderType = 'agent';
      senderName = req.user?.name || 'Support Agent';
    } else if (conversation.isGuest) {
      const guestToken = req.headers['x-guest-token'] || req.query.token;
      if (!guestToken || hashToken(guestToken) !== conversation.guestInfo?.tokenHash) {
        return res.status(403).json({ success: false, message: 'Invalid guest token' });
      }
      senderType = 'guest';
    } else if (!req.user || conversation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const actualInternal = isStaff ? Boolean(isInternalNote) : false;

    const newMsg = await ChatMessage.create({
      conversation: conversation._id,
      sender: senderId,
      senderType,
      senderName,
      message: message.trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      isInternalNote: actualInternal,
      messageType: actualInternal ? 'note' : attachments.length > 0 ? 'attachment' : 'text',
    });

    if (!actualInternal) {
      conversation.lastMessage = {
        text: message.trim(),
        senderRole: senderType,
        timestamp: new Date(),
      };
      conversation.lastActivityAt = new Date();

      if (isStaff) {
        conversation.unreadCustomerCount = (conversation.unreadCustomerCount || 0) + 1;
        if (conversation.status === 'waiting_agent') conversation.status = 'active';
      } else {
        conversation.unreadStaffCount = (conversation.unreadStaffCount || 0) + 1;
      }
      await conversation.save();
    }

    // Socket.IO real-time emission
    const io = getIO();
    if (io) {
      if (actualInternal) {
        io.to('staff:support').emit('new_internal_note', { conversationId: conversation._id, message: newMsg });
      } else {
        io.to(`conversation:${conversation._id}`).emit('new_message', { conversationId: conversation._id, message: newMsg });
        io.to('staff:support').emit('conversation_updated', {
          conversationId: conversation._id,
          lastMessage: conversation.lastMessage,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: newMsg,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Convert a Live Chat Conversation into a Formal Support Ticket
 * @route POST /api/chat/:id/convert-to-ticket
 */
export const convertChatToTicket = async (req, res, next) => {
  try {
    const conversation = await ChatConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (conversation.status === 'converted_to_ticket' && conversation.convertedTicket) {
      return res.status(400).json({
        success: false,
        message: 'This conversation has already been converted to a ticket.',
        convertedTicketId: conversation.convertedTicket,
      });
    }

    // Pull all chat messages
    const chatMessages = await ChatMessage.find({ conversation: conversation._id }).sort({ createdAt: 1 });

    const ticketNumber = `TKT-CVT-${Date.now().toString().slice(-5)}-${Math.floor(100 + Math.random() * 900)}`;
    const deadlines = await slaService.calculateDeadlines(conversation.priority || 'normal');

    // Build ticket messages array preserving entire conversation
    const ticketMessages = chatMessages.map((cm) => ({
      sender: cm.sender,
      senderRole: cm.senderType === 'agent' ? 'admin' : cm.senderType === 'guest' ? 'guest' : 'customer',
      senderName: cm.senderName,
      message: cm.message,
      attachments: cm.attachments?.map((a) => a.url) || [],
      isInternal: cm.isInternalNote,
      createdAt: cm.createdAt,
    }));

    // If no messages yet, add an initial summary
    if (ticketMessages.length === 0) {
      ticketMessages.push({
        sender: req.user?._id || conversation.customer || null,
        senderRole: conversation.isGuest ? 'guest' : 'customer',
        senderName: conversation.isGuest ? conversation.guestInfo?.name : 'Customer',
        message: `Live chat session #${conversation.conversationId} converted to official support ticket.`,
        isInternal: false,
        createdAt: new Date(),
      });
    }

    const ticketSubject = req.body.subject || `[Live Chat ${conversation.conversationId}] ${conversation.category}`;

    const newTicket = await SupportTicket.create({
      ticketNumber,
      user: conversation.customer || null,
      isGuest: conversation.isGuest,
      guestInfo: conversation.isGuest ? conversation.guestInfo : undefined,
      subject: ticketSubject,
      category: conversation.category || 'General Inquiry',
      priority: conversation.priority || 'normal',
      status: 'open',
      assignedTo: conversation.assignedAgent || null,
      department: conversation.department || null,
      relatedOrder: conversation.relatedOrder || null,
      relatedProduct: conversation.relatedProduct || null,
      linkedConversation: conversation._id,
      firstResponseDueAt: deadlines.firstResponseDueAt,
      resolutionDueAt: deadlines.resolutionDueAt,
      firstResponseAt: new Date(),
      messages: ticketMessages,
      activityLog: [
        {
          action: 'CHAT_CONVERTED_TO_TICKET',
          actor: req.user?._id || null,
          actorName: req.user?.name || 'Support Agent',
          details: { originalConversationId: conversation.conversationId },
          timestamp: new Date(),
        },
      ],
    });

    // Update conversation record
    conversation.status = 'converted_to_ticket';
    conversation.convertedTicket = newTicket._id;
    conversation.convertedAt = new Date();
    conversation.convertedBy = req.user?._id || null;
    await conversation.save();

    await rbacService.recordAuditLog({
      actor: req.user?._id || null,
      actorEmail: req.user?.email || 'customer',
      actorRole: req.user?.role || 'customer',
      action: 'CHAT_CONVERTED_TO_TICKET',
      entity: 'SupportTicket',
      entityId: newTicket._id.toString(),
      details: { conversationId: conversation.conversationId, ticketNumber },
      severity: SENSITIVITY_LEVELS.MEDIUM,
    });

    return res.status(201).json({
      success: true,
      message: `Conversation successfully converted to ticket #${newTicket.ticketNumber}`,
      ticket: newTicket,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Assign chat to agent
 * @route PUT /api/chat/:id/assign
 */
export const assignChat = async (req, res, next) => {
  try {
    const { agentId } = req.body;
    const conversation = await ChatConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (agentId) {
      const agent = await User.findById(agentId);
      if (!agent || agent.isSuspended || !agent.isActive) {
        return res.status(400).json({ success: false, message: 'Target agent is invalid or suspended' });
      }
      conversation.assignedAgent = agent._id;
      conversation.status = 'assigned';
    } else {
      conversation.assignedAgent = null;
      conversation.status = 'waiting_agent';
    }

    await conversation.save();

    return res.status(200).json({
      success: true,
      message: agentId ? 'Conversation assigned successfully' : 'Conversation unassigned',
      conversation,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Resolve or close a live chat
 * @route PUT /api/chat/:id/status
 */
export const updateChatStatus = async (req, res, next) => {
  try {
    const { status } = req.body; // 'active' | 'resolved' | 'closed'
    const conversation = await ChatConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    conversation.status = status;
    await conversation.save();

    return res.status(200).json({
      success: true,
      message: `Chat conversation marked as ${status}`,
      conversation,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Customer rates completed chat
 * @route POST /api/chat/:id/rate
 */
export const rateChat = async (req, res, next) => {
  try {
    const { score, feedback } = req.body;
    const conversation = await ChatConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    conversation.customerRating = {
      score: Number(score),
      feedback: feedback || '',
      ratedAt: new Date(),
    };
    await conversation.save();

    return res.status(200).json({
      success: true,
      message: 'Thank you for your feedback!',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Staff: List live chat conversations with filters
 * @route GET /api/chat
 */
export const listConversations = async (req, res, next) => {
  try {
    const { status, assignedAgent, department, category, search, page = 1, limit = 30 } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (assignedAgent && assignedAgent !== 'all') {
      filter.assignedAgent = assignedAgent;
    }
    if (department && department !== 'all') {
      filter.department = department;
    }
    if (category && category !== 'all') {
      filter.category = category;
    }

    if (search && search.trim()) {
      filter.$or = [
        { conversationId: { $regex: search.trim(), $options: 'i' } },
        { 'guestInfo.name': { $regex: search.trim(), $options: 'i' } },
        { 'guestInfo.email': { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const conversations = await ChatConversation.find(filter)
      .populate('customer', 'name email avatar')
      .populate('assignedAgent', 'name email avatar')
      .populate('department', 'name')
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await ChatConversation.countDocuments(filter);

    return res.status(200).json({
      success: true,
      conversations,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    next(err);
  }
};
