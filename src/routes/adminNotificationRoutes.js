import express from 'express';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  getPushStats,
  getSubscribersList,
  broadcastPushHandler,
  getBroadcastLogs,
  getPushSettings,
  updatePushSettings,
  regenerateKeysHandler,
  sendAdminTestPush,
} from '../controllers/adminNotificationController.js';

const router = express.Router();

router.use(protect);

router.get('/stats', requirePermission('marketing.view'), getPushStats);
router.get('/subscribers', requirePermission('marketing.view'), getSubscribersList);
router.post('/broadcast', requirePermission('marketing.create'), broadcastPushHandler);
router.get('/broadcasts', requirePermission('marketing.view'), getBroadcastLogs);
router.get('/settings', requirePermission('marketing.view'), getPushSettings);
router.put('/settings', requirePermission('marketing.manage'), updatePushSettings);
router.post('/regenerate-keys', requirePermission('system_settings.manage'), regenerateKeysHandler);
router.post('/send-test', requirePermission('marketing.create'), sendAdminTestPush);

export default router;

