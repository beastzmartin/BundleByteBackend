import express from 'express';
import {
  getAdminUsers,
  getUser360Profile,
  updateAccountControls,
  revokeUserSessions,
  updateUserRole,
  addAdminNote,
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

export default router;
