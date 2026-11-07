import express from 'express';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  listDepartments,
  getHierarchy,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentController.js';

const router = express.Router();

router.use(protect);

router.get('/', requirePermission('team_management.view'), listDepartments);
router.get('/hierarchy', requirePermission('team_management.view'), getHierarchy);
router.post('/', requirePermission('team_management.configure'), createDepartment);
router.put('/:id', requirePermission('team_management.configure'), updateDepartment);
router.delete('/:id', requirePermission('team_management.configure'), deleteDepartment);

export default router;

