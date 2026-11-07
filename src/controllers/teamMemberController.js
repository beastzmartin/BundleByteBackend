import TeamMember from '../models/TeamMember.js';
import User from '../models/User.js';
import TeamRole from '../models/TeamRole.js';
import Department from '../models/Department.js';
import TeamInvitation from '../models/TeamInvitation.js';
import AuditLog from '../models/AuditLog.js';
import rbacService from '../services/rbacService.js';
import { SENSITIVITY_LEVELS } from '../constants/permissionsRegistry.js';

/**
 * @desc Get Team Dashboard metrics & overview stats
 * @route GET /api/admin/team/metrics
 */
export const getTeamDashboardMetrics = async (req, res) => {
  try {
    const totalMembers = await TeamMember.countDocuments();
    const activeMembers = await TeamMember.countDocuments({ status: 'active' });
    const suspendedMembers = await TeamMember.countDocuments({ status: 'suspended' });
    const pendingInvitations = await TeamInvitation.countDocuments({
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });
    const totalRoles = await TeamRole.countDocuments();

    // Online members: active within the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const onlineMembers = await TeamMember.countDocuments({
      status: 'active',
      lastActiveAt: { $gte: fifteenMinutesAgo },
    });

    // Recent team activities from AuditLog
    const recentActivities = await AuditLog.find({
      entity: { $in: ['TeamMember', 'TeamRole', 'TeamInvitation', 'ApprovalRequest', 'Department', 'RBAC_SECURITY'] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('actor', 'name email avatar role');

    return res.status(200).json({
      success: true,
      metrics: {
        totalMembers,
        activeMembers,
        pendingInvitations,
        suspendedMembers,
        totalRoles,
        onlineMembers,
      },
      recentActivities,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc List team members with search, filter, and pagination
 * @route GET /api/admin/team/members
 */
export const listTeamMembers = async (req, res) => {
  try {
    const { search, role, department, status, sort = 'createdAt', order = 'desc', page = 1, limit = 20 } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (department) {
      query.department = department;
    }

    if (role) {
      const targetRole = await TeamRole.findOne({ $or: [{ slug: role }, { _id: role.match(/^[0-9a-fA-F]{24}$/) ? role : null }] });
      if (targetRole) {
        query.roles = targetRole._id;
      }
    }

    // Build user search if provided
    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');

      const userIds = matchingUsers.map((u) => u._id);
      query.$or = [
        { user: { $in: userIds } },
        { employeeCode: { $regex: search, $options: 'i' } },
        { jobTitle: { $regex: search, $options: 'i' } },
      ];
    }

    const sortOptions = {};
    sortOptions[sort] = order === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    const members = await TeamMember.find(query)
      .populate('user', 'name email avatar role isActive isSuspended lastLoginAt')
      .populate('roles', 'name slug isProtected isSystemRole')
      .populate('department', 'name slug')
      .populate('reportingManager', 'name email avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const total = await TeamMember.countDocuments(query);

    return res.status(200).json({
      success: true,
      members,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Get single team member details with resolved effective permissions
 * @route GET /api/admin/team/members/:id
 */
export const getTeamMemberById = async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id)
      .populate('user', 'name email avatar role isActive isSuspended loginHistory createdAt')
      .populate('roles')
      .populate('department')
      .populate('reportingManager', 'name email avatar jobTitle');

    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    // Resolve full effective permissions for this member
    const effectivePermissions = await rbacService.getUserEffectivePermissions(member.user._id);

    // Member's recent audit activities
    const memberActivities = await AuditLog.find({ actor: member.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.status(200).json({
      success: true,
      member,
      effectivePermissions,
      memberActivities,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Create / Add a team member directly
 * @route POST /api/admin/team/members
 */
export const createTeamMember = async (req, res) => {
  try {
    const { userId, email, name, roleIds = [], departmentId, jobTitle, reportingManagerId, employeeCode } = req.body;

    let targetUser;
    if (userId) {
      targetUser = await User.findById(userId);
    } else if (email) {
      targetUser = await User.findOne({ email: email.toLowerCase().trim() });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found. Please use the Team Invitation system to invite new external users.',
      });
    }

    // Check if team member already exists
    const existing = await TeamMember.findOne({ user: targetUser._id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This user is already a team member. You can edit their roles or department instead.',
      });
    }

    // Privilege escalation check on assigned roles
    const roles = await TeamRole.find({ _id: { $in: roleIds } });
    const allRolePerms = roles.reduce((acc, r) => [...acc, ...r.permissions], []);
    const escalationCheck = await rbacService.checkPrivilegeEscalation(req.user._id, allRolePerms);
    if (!escalationCheck.allowed) {
      return res.status(403).json({ success: false, message: escalationCheck.message });
    }

    const memberCount = await TeamMember.countDocuments();
    const finalCode = employeeCode || `BB-EMP-${String(memberCount + 1).padStart(3, '0')}`;

    const newMember = await TeamMember.create({
      user: targetUser._id,
      employeeCode: finalCode,
      jobTitle: jobTitle || 'Team Member',
      department: departmentId || null,
      roles: roleIds,
      reportingManager: reportingManagerId || null,
      status: 'active',
    });

    // Update user role if assigned a primary role
    if (roles.length > 0) {
      targetUser.role = roles[0].slug;
      await targetUser.save();
    }

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'TEAM_MEMBER_CREATED',
      entity: 'TeamMember',
      entityId: newMember._id.toString(),
      details: { email: targetUser.email, employeeCode: finalCode, rolesCount: roleIds.length },
      severity: SENSITIVITY_LEVELS.HIGH,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Team member created successfully',
      member: newMember,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Update team member details, roles, department, or direct overrides
 * @route PUT /api/admin/team/members/:id
 */
export const updateTeamMember = async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id).populate('user');
    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    const {
      jobTitle,
      departmentId,
      roleIds,
      reportingManagerId,
      employeeCode,
      directPermissionOverrides,
      resourceScopes,
    } = req.body;

    // Protect Super Admin / Owner from demotion by non-owners
    if (member.user && member.user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You cannot modify the Organization Owner / Super Admin.',
      });
    }

    // Privilege escalation check on newly assigned roles
    if (roleIds && Array.isArray(roleIds)) {
      const assignedRoles = await TeamRole.find({ _id: { $in: roleIds } });
      const targetPermissions = assignedRoles.reduce((acc, r) => [...acc, ...r.permissions], []);
      const escalationCheck = await rbacService.checkPrivilegeEscalation(req.user._id, targetPermissions);
      if (!escalationCheck.allowed) {
        return res.status(403).json({ success: false, message: escalationCheck.message });
      }
      member.roles = roleIds;

      // Update primary user role
      if (assignedRoles.length > 0 && member.user && member.user.role !== 'super_admin') {
        member.user.role = assignedRoles[0].slug;
        await member.user.save();
      }
    }

    // Privilege escalation check on direct allow overrides
    if (directPermissionOverrides && Array.isArray(directPermissionOverrides)) {
      const allowOverrides = directPermissionOverrides
        .filter((o) => o.effect === 'allow')
        .map((o) => o.permissionKey);
      const escalationCheck = await rbacService.checkPrivilegeEscalation(req.user._id, allowOverrides);
      if (!escalationCheck.allowed) {
        return res.status(403).json({ success: false, message: escalationCheck.message });
      }
      member.directPermissionOverrides = directPermissionOverrides.map((o) => ({
        ...o,
        grantedBy: req.user._id,
        createdAt: new Date(),
      }));
    }

    if (jobTitle !== undefined) member.jobTitle = jobTitle;
    if (departmentId !== undefined) member.department = departmentId || null;
    if (reportingManagerId !== undefined) member.reportingManager = reportingManagerId || null;
    if (employeeCode !== undefined) member.employeeCode = employeeCode;
    if (resourceScopes) member.resourceScopes = resourceScopes;

    await member.save();

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'TEAM_MEMBER_UPDATED',
      entity: 'TeamMember',
      entityId: member._id.toString(),
      details: { email: member.user?.email, jobTitle: member.jobTitle },
      severity: SENSITIVITY_LEVELS.HIGH,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: 'Team member updated successfully',
      member,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Suspend or Activate team member account & enforce immediate session invalidation
 * @route POST /api/admin/team/members/:id/status
 */
export const updateMemberStatus = async (req, res) => {
  try {
    const { status, reason } = req.body; // status: 'active' | 'suspended' | 'deactivated'

    if (!['active', 'suspended', 'deactivated'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'active', 'suspended', or 'deactivated'.",
      });
    }

    const member = await TeamMember.findById(req.params.id).populate('user');
    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    // Protect Super Admin from suspension
    if (member.user && member.user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot suspend the Super Admin / Organization Owner.',
      });
    }

    member.status = status;
    if (status === 'suspended') {
      member.suspendedReason = reason || 'Suspended by administrative policy';
      member.suspendedAt = new Date();
      member.suspendedBy = req.user._id;

      // Invalidate active session immediately by bumping user tokenVersion
      if (member.user) {
        member.user.isSuspended = true;
        member.user.suspendedReason = member.suspendedReason;
        member.user.tokenVersion = (member.user.tokenVersion || 0) + 1;
        await member.user.save();
      }
    } else if (status === 'active') {
      member.suspendedReason = '';
      member.suspendedAt = null;
      member.suspendedBy = null;
      if (member.user) {
        member.user.isSuspended = false;
        member.user.suspendedReason = '';
        await member.user.save();
      }
    }

    await member.save();

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: `TEAM_MEMBER_${status.toUpperCase()}`,
      entity: 'TeamMember',
      entityId: member._id.toString(),
      details: { email: member.user?.email, status, reason },
      severity: SENSITIVITY_LEVELS.CRITICAL,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: `Team member status set to ${status}. All active sessions immediately invalidated if suspended.`,
      member,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Force logout / Revoke all active sessions for a team member
 * @route POST /api/admin/team/members/:id/revoke-sessions
 */
export const revokeMemberSessions = async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id).populate('user');
    if (!member || !member.user) {
      return res.status(404).json({ success: false, message: 'Team member or user account not found' });
    }

    member.user.tokenVersion = (member.user.tokenVersion || 0) + 1;
    await member.user.save();

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'TEAM_MEMBER_SESSIONS_REVOKED',
      entity: 'TeamMember',
      entityId: member._id.toString(),
      details: { email: member.user.email, newTokenVersion: member.user.tokenVersion },
      severity: SENSITIVITY_LEVELS.HIGH,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: `All active sessions revoked for ${member.user.email}. User must log in again.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Remove / Delete a team member
 * @route DELETE /api/admin/team/members/:id
 */
export const deleteTeamMember = async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id).populate('user');
    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    if (member.user && member.user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete the Super Admin / Organization Owner.',
      });
    }

    // Demote user role back to customer if they don't have other admin assignments
    if (member.user) {
      member.user.role = 'customer';
      member.user.tokenVersion = (member.user.tokenVersion || 0) + 1;
      await member.user.save();
    }

    await TeamMember.findByIdAndDelete(member._id);

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'TEAM_MEMBER_DELETED',
      entity: 'TeamMember',
      entityId: member._id.toString(),
      details: { email: member.user?.email },
      severity: SENSITIVITY_LEVELS.HIGH,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: 'Team member removed successfully and permissions revoked.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Query Team Activity & RBAC Audit Logs
 * @route GET /api/admin/team/activity
 */
export const getTeamActivityLogs = async (req, res) => {
  try {
    const { action, entity, severity, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (severity) filter.severity = severity;

    const skip = (Number(page) - 1) * Number(limit);

    const logs = await AuditLog.find(filter)
      .populate('actor', 'name email avatar role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await AuditLog.countDocuments(filter);

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

