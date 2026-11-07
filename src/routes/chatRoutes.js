import express from 'express';
import { protect, optionalProtect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  initiateChat,
  getChatHistory,
  sendChatMessage,
  convertChatToTicket,
  assignChat,
  updateChatStatus,
  rateChat,
  listConversations,
} from '../controllers/chatController.js';

const router = express.Router();

// Public & Customer Endpoints (supports both authenticated accounts and guests)
router.post('/initiate', optionalProtect, initiateChat);
router.get('/:id', optionalProtect, getChatHistory);
router.post('/:id/messages', optionalProtect, sendChatMessage);
router.post('/:id/convert-to-ticket', optionalProtect, convertChatToTicket);
router.post('/:id/rate', optionalProtect, rateChat);

// Staff Support Endpoints (governed by RBAC)
router.get('/', protect, requirePermission('live_chat.view'), listConversations);
router.put('/:id/assign', protect, requirePermission('live_chat.assign'), assignChat);
router.put('/:id/status', protect, requirePermission('live_chat.resolve'), updateChatStatus);

export default router;
