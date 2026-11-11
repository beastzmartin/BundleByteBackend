import express from 'express';
import {
  getAdminUsers,
  getUser360Profile,
  updateAccountControls,
  revokeUserSessions,
  updateUserRole,
  addAdminNote,
  adminChangeUserPassword,
  adminImpersonateUser,
  adminSendPasswordResetEmail,
} from '../controllers/adminUserController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

router.get('/', requirePermission('customers.view'), getAdminUsers);
router.get('/:id/360', requirePermission('customers.view'), getUser360Profile);
router.put('/:id/controls', requirePermission('customers.manage'), updateAccountControls);
router.post('/:id/revoke-sessions', requirePermission('customers.manage'), revokeUserSessions);
router.put('/:id/role', requirePermission('team_management.manage'), updateUserRole);
router.post('/:id/notes', requirePermission('customers.update'), addAdminNote);
router.put('/:id/password', requirePermission('customers.manage'), adminChangeUserPassword);
router.post('/:id/impersonate', requirePermission('customers.manage'), adminImpersonateUser);
router.post('/:id/send-reset-email', requirePermission('customers.manage'), adminSendPasswordResetEmail);

export default router;
