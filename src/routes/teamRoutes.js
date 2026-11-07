import express from 'express';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  getTeamDashboardMetrics,
  listTeamMembers,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  updateMemberStatus,
  revokeMemberSessions,
  deleteTeamMember,
  getTeamActivityLogs,
} from '../controllers/teamMemberController.js';

const router = express.Router();

router.use(protect);

router.get('/metrics', requirePermission('team_management.view'), getTeamDashboardMetrics);
router.get('/activity', requirePermission('team_management.view'), getTeamActivityLogs);

router.get('/members', requirePermission('team_management.view'), listTeamMembers);
router.post('/members', requirePermission('team_management.create'), createTeamMember);

router.get('/members/:id', requirePermission('team_management.read'), getTeamMemberById);
router.put('/members/:id', requirePermission('team_management.update'), updateTeamMember);
router.delete('/members/:id', requirePermission('team_management.delete'), deleteTeamMember);

router.post('/members/:id/status', requirePermission('team_management.manage'), updateMemberStatus);
router.post('/members/:id/revoke-sessions', requirePermission('team_management.manage'), revokeMemberSessions);

export default router;

