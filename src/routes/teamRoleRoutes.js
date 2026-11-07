import express from 'express';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  getPermissionsRegistry,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  duplicateRole,
  deleteRole,
} from '../controllers/teamRoleController.js';

const router = express.Router();

router.use(protect);

router.get('/permissions-registry', requirePermission('team_management.view'), getPermissionsRegistry);
router.get('/', requirePermission('team_management.view'), listRoles);
router.get('/:id', requirePermission('team_management.read'), getRoleById);
router.post('/', requirePermission('team_management.create'), createRole);
router.put('/:id', requirePermission('team_management.update'), updateRole);
router.post('/:id/duplicate', requirePermission('team_management.create'), duplicateRole);
router.delete('/:id', requirePermission('team_management.delete'), deleteRole);

export default router;

