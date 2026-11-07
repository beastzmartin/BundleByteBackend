import express from 'express';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  getSupportAnalytics,
  listSLAPolicies,
  updateSLAPolicy,
} from '../controllers/supportAnalyticsController.js';

const router = express.Router();

router.use(protect);

router.get('/analytics', requirePermission('support_tickets.view'), getSupportAnalytics);
router.get('/sla', requirePermission('support_tickets.manage'), listSLAPolicies);
router.put('/sla/:id', requirePermission('support_tickets.manage'), updateSLAPolicy);

export default router;
