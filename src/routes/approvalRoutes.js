import express from 'express';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  listApprovals,
  getApprovalById,
  reviewApproval,
  listWorkflows,
  updateWorkflow,
} from '../controllers/approvalController.js';

const router = express.Router();

router.use(protect);

router.get('/', requirePermission('team_management.view'), listApprovals);
router.get('/workflows', requirePermission('team_management.view'), listWorkflows);
router.put('/workflows/:id', requirePermission('team_management.configure'), updateWorkflow);
router.get('/:id', requirePermission('team_management.view'), getApprovalById);
router.post('/:id/review', requirePermission('team_management.approve'), reviewApproval);

export default router;

