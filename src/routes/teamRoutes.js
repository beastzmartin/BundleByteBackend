import express from 'express';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  getMyTeamProfile,
  getTeamDashboardMetrics,
  listTeamMembers,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  updateMemberStatus,
  revokeMemberSessions,
  deleteTeamMember,
  getTeamActivityLogs,
  addDirectOverride,
  removeDirectOverride,
} from '../controllers/teamMemberController.js';

const router = express.Router();

router.use(protect);

// Self Team Profile & Workspace (Any authenticated staff/team member can access their own workspace)
router.get('/me', getMyTeamProfile);

router.get('/metrics', requirePermission('team_management.view'), getTeamDashboardMetrics);
router.get('/activity', requirePermission('team_management.view'), getTeamActivityLogs);

router.get('/members', requirePermission('team_management.view'), listTeamMembers);
router.post('/members', requirePermission('team_management.create'), createTeamMember);

router.get('/members/:id', requirePermission('team_management.read'), getTeamMemberById);
router.put('/members/:id', requirePermission('team_management.update'), updateTeamMember);
router.delete('/members/:id', requirePermission('team_management.delete'), deleteTeamMember);

router.post('/members/:id/status', requirePermission('team_management.manage'), updateMemberStatus);
router.post('/members/:id/revoke-sessions', requirePermission('team_management.manage'), revokeMemberSessions);

// Direct Permission Overrides
router.post('/members/:id/overrides', requirePermission('team_management.manage'), addDirectOverride);
router.delete('/members/:id/overrides/:overrideId', requirePermission('team_management.manage'), removeDirectOverride);

export default router;

