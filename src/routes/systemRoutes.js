import express from 'express';
import {
  getSystemStats,
  flushCache,
  cleanStorage,
  purgeLiveChats,
  purgeSupportTickets,
  purgeDatabaseLogs,
} from '../controllers/systemManagerController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.get('/system/stats', protect, requirePermission('system_settings.view'), getSystemStats);
router.post('/system/cache/flush', protect, requirePermission('system_settings.manage'), flushCache);
router.post('/system/storage/clean', protect, requirePermission('system_settings.manage'), cleanStorage);
router.post('/system/purge/chats', protect, requirePermission('system_settings.manage'), purgeLiveChats);
router.post('/system/purge/tickets', protect, requirePermission('system_settings.manage'), purgeSupportTickets);
router.post('/system/purge/logs', protect, requirePermission('system_settings.manage'), purgeDatabaseLogs);

export default router;

