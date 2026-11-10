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
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.use(protect);

router.get('/', authorize('admin', 'manager', 'support_agent'), getAdminUsers);
router.get('/:id/360', authorize('admin', 'manager', 'support_agent'), getUser360Profile);
router.put('/:id/controls', authorize('admin', 'manager'), updateAccountControls);
router.post('/:id/revoke-sessions', authorize('admin', 'manager'), revokeUserSessions);
router.put('/:id/role', authorize('admin'), updateUserRole);
router.post('/:id/notes', authorize('admin', 'manager', 'support_agent'), addAdminNote);
router.put('/:id/password', authorize('admin', 'manager'), adminChangeUserPassword);
router.post('/:id/impersonate', authorize('admin', 'manager'), adminImpersonateUser);
router.post('/:id/send-reset-email', authorize('admin', 'manager'), adminSendPasswordResetEmail);

export default router;
