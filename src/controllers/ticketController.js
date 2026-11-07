import crypto from 'crypto';
import SupportTicket, { SUPPORT_CATEGORIES, TICKET_STATUSES, TICKET_PRIORITIES } from '../models/SupportTicket.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { sendTicketReplyNotification } from '../services/emailService.js';
import assignmentService from '../services/assignmentService.js';
import slaService from '../services/slaService.js';
import rbacService from '../services/rbacService.js';
import { SENSITIVITY_LEVELS } from '../constants/permissionsRegistry.js';

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * POST /api/tickets
 * Create a new support ticket (Registered Customer or Guest)
 */
export const createTicket = async (req, res, next) => {
  try {
    const {
      subject,
      category = 'General Inquiry',
      priority = 'normal',
      ticketType = 'general_support',
      message,
      attachments = [],
      relatedOrder,
      relatedProduct,
      departmentId,
      guestName,
      guestEmail,
      guestPhone,
    } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Please provide a subject and message description' });
    }

    const ticketNumber = `TKT-${Date.now().toString().slice(-5)}-${Math.floor(100 + Math.random() * 900)}`;

    let userRef = req.user ? req.user._id : null;
    let isGuest = !req.user;
    let guestInfo = undefined;
    let rawGuestToken = null;

    if (isGuest) {
      if (!guestName || !guestEmail) {
        return res.status(400).json({
          success: false,
          message: 'Guest tickets require full name and email address.',
        });
      }

      rawGuestToken = crypto.randomBytes(32).toString('hex');
      guestInfo = {
        name: guestName.trim(),
        email: guestEmail.toLowerCase().trim(),
        phone: guestPhone || '',
        tokenHash: hashToken(rawGuestToken),
      };
    }

    // Dynamic SLA Deadlines
    const deadlines = await slaService.calculateDeadlines(priority);

    // Smart Agent Assignment
    const assignedAgent = await assignmentService.findOptimalAgent({
      channel: 'ticket',
      departmentId,
    });

    const ticket = await SupportTicket.create({
      ticketNumber,
      user: userRef,
      isGuest,
      guestInfo,
      ticketType,
      subject: subject.trim(),
      category,
      priority,
      status: assignedAgent ? 'assigned' : 'open',
      assignedTo: assignedAgent?._id || null,
      department: departmentId || null,
      relatedOrder: relatedOrder || null,
      relatedProduct: relatedProduct || null,
      firstResponseDueAt: deadlines.firstResponseDueAt,
      resolutionDueAt: deadlines.resolutionDueAt,
      messages: [
        {
          sender: userRef,
          senderRole: isGuest ? 'guest' : req.user.role,
          senderName: isGuest ? guestName.trim() : req.user.name,
          message: message.trim(),
          attachments: Array.isArray(attachments) ? attachments : [],
          isInternal: false,
          createdAt: new Date(),
        },
      ],
      activityLog: [
        {
          action: 'TICKET_CREATED',
          actor: userRef,
          actorName: isGuest ? guestName.trim() : req.user.name,
          details: { category, priority, isGuest },
          timestamp: new Date(),
        },
      ],
    });

    // Notify staff
    try {
      const staffUsers = await User.find({ role: { $in: ['admin', 'manager', 'support_agent'] } });
      const submitterName = isGuest ? `${guestName} (Guest)` : req.user.name;
      for (const staff of staffUsers) {
        await Notification.create({
          user: staff._id,
          title: `New Support Ticket: #${ticket.ticketNumber}`,
          message: `${submitterName} submitted "${subject}" [${category}]`,
          type: 'system',
          link: `/admin/support`,
        });
      }
    } catch (notifErr) {
      console.error('Staff notification error:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully',
      ticket,
      rawGuestToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/guest/:token
 * Public endpoint: Retrieve ticket details using a signed guest token
 */
export const getGuestTicket = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Guest access token is required.' });
    }

    const tokenHash = hashToken(token);
    const ticket = await SupportTicket.findOne({ 'guestInfo.tokenHash': tokenHash })
      .populate('relatedOrder', 'orderNumber totalAmount paymentStatus deliveryStatus createdAt')
      .populate('relatedProduct', 'title slug logo');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Invalid or expired ticket access link.' });
    }

    const ticketObj = ticket.toObject();
    delete ticketObj.internalNotes;
    if (Array.isArray(ticketObj.messages)) {
      ticketObj.messages = ticketObj.messages.filter((m) => !m.isInternal);
    }

    return res.status(200).json({
      success: true,
      ticket: ticketObj,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/guest/:token/reply
 * Public endpoint: Reply to a ticket using guest token
 */
export const replyGuestTicket = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { message, attachments = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be blank' });
    }

    const tokenHash = hashToken(token);
    const ticket = await SupportTicket.findOne({ 'guestInfo.tokenHash': tokenHash });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found or invalid token' });
    }

    ticket.messages.push({
      sender: null,
      senderRole: 'guest',
      senderName: ticket.guestInfo?.name || 'Guest Customer',
      message: message.trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      isInternal: false,
      createdAt: new Date(),
    });

    ticket.status = 'in_progress';
    ticket.unreadByAdminCount = (ticket.unreadByAdminCount || 0) + 1;
    await ticket.save();

    const resObj = ticket.toObject();
    delete resObj.internalNotes;
    resObj.messages = resObj.messages.filter((m) => !m.isInternal);

    return res.status(200).json({
      success: true,
      message: 'Reply posted successfully',
      ticket: resObj,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/my
 * Customer's own tickets list
 */
export const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id })
      .populate('relatedOrder', 'orderNumber totalAmount paymentStatus deliveryStatus createdAt')
      .populate('relatedProduct', 'title slug logo')
      .sort({ updatedAt: -1 });

    const sanitizedTickets = tickets.map((t) => {
      const obj = t.toObject();
      delete obj.internalNotes;
      if (Array.isArray(obj.messages)) {
        obj.messages = obj.messages.filter((m) => !m.isInternal);
      }
      return obj;
    });

    res.status(200).json({ success: true, count: sanitizedTickets.length, tickets: sanitizedTickets });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/:id
 * Retrieve single ticket details
 */
export const getTicketById = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('user', 'name email avatar')
      .populate({
        path: 'relatedOrder',
        select: 'orderNumber totalAmount paymentStatus deliveryStatus createdAt items',
        populate: { path: 'items.product', select: 'title logo deliveryMethod' },
      })
      .populate('relatedProduct', 'title slug logo price')
      .populate('assignedTo', 'name email avatar')
      .populate('department', 'name slug')
      .populate('linkedConversation', 'conversationId status');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const isStaff = req.user && ['super_admin', 'admin', 'manager', 'support_agent'].includes(req.user.role);
    const isOwner = req.user && ticket.user && ticket.user._id.toString() === req.user._id.toString();

    if (!isStaff && !isOwner) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this ticket' });
    }

    const ticketObj = ticket.toObject();

    // Security: Filter internal notes for customers
    if (!isStaff) {
      delete ticketObj.internalNotes;
      if (Array.isArray(ticketObj.messages)) {
        ticketObj.messages = ticketObj.messages.filter((m) => !m.isInternal);
      }
      if (ticket.unreadByCustomerCount > 0) {
        ticket.unreadByCustomerCount = 0;
        await ticket.save();
      }
    } else {
      if (ticket.unreadByAdminCount > 0) {
        ticket.unreadByAdminCount = 0;
        await ticket.save();
      }
    }

    res.status(200).json({ success: true, ticket: ticketObj });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:id/reply
 * Reply to a ticket (Customer or Staff)
 */
export const replyTicket = async (req, res, next) => {
  try {
    const { message, attachments = [], isInternal = false } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const isStaff = req.user && ['super_admin', 'admin', 'manager', 'support_agent'].includes(req.user.role);
    const isOwner = req.user && ticket.user && ticket.user.toString() === req.user._id.toString();

    if (!isStaff && !isOwner) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const actualIsInternal = isStaff ? Boolean(isInternal) : false;

    const newMessage = {
      sender: req.user._id,
      senderRole: req.user.role,
      senderName: req.user.name,
      message: message.trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      isInternal: actualIsInternal,
      createdAt: new Date(),
    };

    ticket.messages.push(newMessage);

    if (actualIsInternal) {
      await ticket.save();
      return res.status(200).json({
        success: true,
        message: 'Internal note added for staff review',
        ticket,
      });
    }

    if (isStaff) {
      ticket.status = 'waiting_for_customer';
      ticket.unreadByCustomerCount = (ticket.unreadByCustomerCount || 0) + 1;
      if (!ticket.firstResponseAt) {
        ticket.firstResponseAt = new Date();
      }

      // Customer notifications
      try {
        if (ticket.user) {
          await Notification.create({
            user: ticket.user,
            title: `Update on Ticket #${ticket.ticketNumber}`,
            message: `Support team replied: "${message.substring(0, 60)}..."`,
            type: 'system',
            link: `/dashboard/tickets`,
          });
          const customerUser = await User.findById(ticket.user);
          if (customerUser) {
            sendTicketReplyNotification(ticket, customerUser, message.substring(0, 160)).catch(() => {});
          }
        }
      } catch (e) {}
    } else {
      ticket.status = 'in_progress';
      ticket.unreadByAdminCount = (ticket.unreadByAdminCount || 0) + 1;
    }

    await ticket.save();

    const resTicket = ticket.toObject();
    if (!isStaff) {
      delete resTicket.internalNotes;
      resTicket.messages = resTicket.messages.filter((m) => !m.isInternal);
    }

    res.status(200).json({ success: true, message: 'Reply sent successfully', ticket: resTicket });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:id/internal-note
 * Staff adds an internal note
 */
export const addInternalNote = async (req, res, next) => {
  try {
    const { note } = req.body;
    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Note text is required' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.messages.push({
      sender: req.user._id,
      senderRole: req.user.role,
      senderName: req.user.name,
      message: note.trim(),
      attachments: [],
      isInternal: true,
      createdAt: new Date(),
    });

    if (!ticket.internalNotes) {
      ticket.internalNotes = `[${new Date().toLocaleDateString()}] ${req.user.name}: ${note.trim()}`;
    } else {
      ticket.internalNotes += `\n[${new Date().toLocaleDateString()}] ${req.user.name}: ${note.trim()}`;
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Internal note saved successfully',
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tickets/:id/assign
 * Staff assigns ticket to a support agent
 */
export const assignTicket = async (req, res, next) => {
  try {
    const { agentId, departmentId } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (agentId) {
      const agent = await User.findById(agentId);
      if (!agent || agent.isSuspended || !agent.isActive) {
        return res.status(400).json({ success: false, message: 'Target agent is invalid or suspended' });
      }
      ticket.assignedTo = agentId;
      ticket.status = ticket.status === 'new' || ticket.status === 'open' ? 'assigned' : ticket.status;
    } else {
      ticket.assignedTo = null;
    }

    if (departmentId !== undefined) {
      ticket.department = departmentId || null;
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      message: agentId ? 'Ticket assigned to agent' : 'Ticket unassigned',
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:id/escalate
 * Staff manually escalates ticket to management
 */
export const escalateTicket = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.isEscalated = true;
    ticket.escalatedAt = new Date();
    ticket.escalatedReason = reason || 'Manual escalation requested';
    ticket.status = 'escalated';
    ticket.priority = 'urgent';

    ticket.activityLog.push({
      action: 'TICKET_MANUALLY_ESCALATED',
      actor: req.user._id,
      actorName: req.user.name,
      details: { reason },
      timestamp: new Date(),
    });

    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket successfully escalated to senior management.',
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:id/rate
 * Customer rates completed ticket
 */
export const rateTicket = async (req, res, next) => {
  try {
    const { score, feedback } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.customerRating = {
      score: Number(score),
      feedback: feedback || '',
      ratedAt: new Date(),
    };
    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Thank you for rating our support service!',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/all
 * Staff view of all tickets with filters, RBAC scope enforcement, and search
 */
export const getAllTickets = async (req, res, next) => {
  try {
    const {
      status,
      priority,
      ticketType,
      category,
      assignedTo,
      department,
      search,
      page = 1,
      limit = 30,
    } = req.query;

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;
    if (ticketType && ticketType !== 'all') query.ticketType = ticketType;
    if (category && category !== 'all') query.category = category;
    if (assignedTo && assignedTo !== 'all') query.assignedTo = assignedTo;
    if (department && department !== 'all') query.department = department;

    // RBAC Scope Check: If user only has view_assigned permission and lacks view_all
    const effectivePerms = await rbacService.getUserEffectivePermissions(req.user._id);
    const canViewAll = effectivePerms.isSuperAdmin || rbacService.hasPermission(effectivePerms, 'support_tickets.view_all');
    if (!canViewAll) {
      // Confine query to tickets assigned to this agent
      query.assignedTo = req.user._id;
    }

    if (search && search.trim()) {
      query.$or = [
        { ticketNumber: { $regex: search.trim(), $options: 'i' } },
        { subject: { $regex: search.trim(), $options: 'i' } },
        { 'guestInfo.name': { $regex: search.trim(), $options: 'i' } },
        { 'guestInfo.email': { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 30;
    const skip = (pageNum - 1) * limitNum;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .populate('user', 'name email avatar')
        .populate('assignedTo', 'name email avatar')
        .populate('department', 'name slug')
        .populate('relatedOrder', 'orderNumber totalAmount paymentStatus deliveryStatus')
        .populate('relatedProduct', 'title slug logo')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      SupportTicket.countDocuments(query),
    ]);

    // Summary counts for tabs
    const [openCount, inProgressCount, waitingCount, resolvedCount, closedCount, escalatedCount] = await Promise.all([
      SupportTicket.countDocuments({ status: 'open' }),
      SupportTicket.countDocuments({ status: 'in_progress' }),
      SupportTicket.countDocuments({ status: 'waiting_for_customer' }),
      SupportTicket.countDocuments({ status: 'resolved' }),
      SupportTicket.countDocuments({ status: 'closed' }),
      SupportTicket.countDocuments({ status: 'escalated' }),
    ]);

    res.status(200).json({
      success: true,
      data: tickets,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
        stats: {
          total,
          open: openCount,
          inProgress: inProgressCount,
          waitingForCustomer: waitingCount,
          resolved: resolvedCount,
          closed: closedCount,
          escalated: escalatedCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tickets/:id/status
 * Update ticket status, priority, or resolution
 */
export const updateTicketStatus = async (req, res, next) => {
  try {
    const { status, priority, resolutionNotes } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const isStaff = req.user && ['super_admin', 'admin', 'manager', 'support_agent'].includes(req.user.role);

    if (status) {
      ticket.status = status;
      if (status === 'resolved') {
        ticket.resolvedAt = new Date();
      }
    }
    if (priority && isStaff) ticket.priority = priority;
    if (resolutionNotes !== undefined && isStaff) ticket.resolutionNotes = resolutionNotes;

    await ticket.save();

    res.status(200).json({ success: true, message: 'Ticket status updated', ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/staff/agents
 * Discovers qualified agents for assignment
 */
export const getSupportAgents = async (req, res, next) => {
  try {
    const eligibleAgents = await assignmentService.getEligibleAgents();
    res.status(200).json({
      success: true,
      agents: eligibleAgents.map((e) => ({
        ...e.user.toObject(),
        openWorkloadCount: e.openWorkloadCount,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/taxonomies
 * Returns categories, statuses, priorities for UI dropdowns
 */
export const getTicketTaxonomies = async (req, res) => {
  res.status(200).json({
    success: true,
    categories: SUPPORT_CATEGORIES,
    statuses: TICKET_STATUSES,
    priorities: TICKET_PRIORITIES,
  });
};
