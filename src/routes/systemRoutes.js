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
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.get('/system/stats', protect, authorize('admin', 'super_admin'), getSystemStats);
router.post('/system/cache/flush', protect, authorize('admin', 'super_admin'), flushCache);
router.post('/system/storage/clean', protect, authorize('admin', 'super_admin'), cleanStorage);
router.post('/system/purge/chats', protect, authorize('admin', 'super_admin'), purgeLiveChats);
router.post('/system/purge/tickets', protect, authorize('admin', 'super_admin'), purgeSupportTickets);
router.post('/system/purge/logs', protect, authorize('admin', 'super_admin'), purgeDatabaseLogs);

export default router;

