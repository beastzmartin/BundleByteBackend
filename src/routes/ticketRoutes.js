import express from 'express';
import {
  createTicket,
  getGuestTicket,
  replyGuestTicket,
  getMyTickets,
  getTicketById,
  replyTicket,
  getAllTickets,
  updateTicketStatus,
  addInternalNote,
  assignTicket,
  escalateTicket,
  rateTicket,
  getSupportAgents,
  getTicketTaxonomies,
} from '../controllers/ticketController.js';
import { protect, optionalProtect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

// Public / Guest Endpoints
router.get('/taxonomies', getTicketTaxonomies);
router.post('/', optionalProtect, createTicket);
router.get('/guest/:token', getGuestTicket);
router.post('/guest/:token/reply', replyGuestTicket);

// Customer Authenticated Endpoints
router.get('/my', protect, getMyTickets);
router.get('/:id', protect, getTicketById);
router.post('/:id/reply', protect, replyTicket);
router.post('/:id/rate', protect, rateTicket);

// Staff RBAC Protected Endpoints
router.get('/all', protect, requirePermission('support_tickets.view'), getAllTickets);
router.get('/staff/agents', protect, requirePermission('support_tickets.assign'), getSupportAgents);
router.put('/:id/assign', protect, requirePermission('support_tickets.assign'), assignTicket);
router.post('/:id/internal-note', protect, requirePermission('support_tickets.internal_notes'), addInternalNote);
router.post('/:id/escalate', protect, requirePermission('support_tickets.escalate'), escalateTicket);
router.put('/:id/status', protect, requirePermission('support_tickets.update'), updateTicketStatus);

export default router;
