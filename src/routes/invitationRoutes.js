import express from 'express';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  listInvitations,
  createInvitation,
  resendInvitation,
  cancelInvitation,
} from '../controllers/invitationController.js';

const router = express.Router();

router.use(protect);

router.get('/', requirePermission('team_management.view'), listInvitations);
router.post('/', requirePermission('team_management.create'), createInvitation);
router.post('/:id/resend', requirePermission('team_management.create'), resendInvitation);
router.post('/:id/cancel', requirePermission('team_management.delete'), cancelInvitation);

export default router;

