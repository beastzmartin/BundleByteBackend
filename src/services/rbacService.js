import TeamRole from '../models/TeamRole.js';
import Department from '../models/Department.js';
import TeamMember from '../models/TeamMember.js';
import ApprovalWorkflow from '../models/ApprovalWorkflow.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import {
  DEFAULT_SYSTEM_ROLES,
  DEFAULT_DEPARTMENTS,
  PERMISSIONS_LIST,
  SENSITIVITY_LEVELS,
} from '../constants/permissionsRegistry.js';

class RBACService {
  /**
   * Initializes default system roles, departments, and approval workflows if not already present.
   */
  async seedSystemRolesAndDepartments() {
    try {
      // 1. Seed Departments
      for (const dept of DEFAULT_DEPARTMENTS) {
        await Department.findOneAndUpdate(
          { slug: dept.slug },
          { $setOnInsert: dept },
          { upsert: true, new: true }
        );
      }

      // 2. Seed System Roles
      for (const roleDef of DEFAULT_SYSTEM_ROLES) {
        const existing = await TeamRole.findOne({ slug: roleDef.slug });
        if (!existing) {
          await TeamRole.create(roleDef);
        } else if (roleDef.isProtected) {
          // Always ensure super_admin is protected and has ['*']
          existing.isProtected = true;
          existing.permissions = ['*'];
          await existing.save();
        }
      }

      // 3. Seed Default Approval Workflows
      const defaultWorkflows = [
        {
          workflowType: 'refund_threshold',
          name: 'High-Value Refund Authorization',
          description: 'Requires finance or administrator sign-off for refunds >= $500 or equivalent',
          thresholdAmount: 500,
          currency: 'USD',
          requiresApproval: true,
          isActive: true,
        },
        {
          workflowType: 'wallet_adjustment',
          name: 'Manual Wallet Credit/Debit Authorization',
          description: 'Requires administrative approval for manual wallet balance adjustments >= $250',
          thresholdAmount: 250,
          currency: 'USD',
          requiresApproval: true,
          isActive: true,
        },
        {
          workflowType: 'gateway_credential',
          name: 'Payment Gateway Credential Mutation',
          description: 'Strict approval required before updating live Paytm or Binance API keys',
          thresholdAmount: 0,
          currency: 'USD',
          requiresApproval: true,
          isActive: true,
        },
        {
          workflowType: 'role_escalation',
          name: 'Role Permission Escalation',
          description: 'Requires owner sign-off when elevating user permissions or assigning admin roles',
          thresholdAmount: 0,
          currency: 'USD',
          requiresApproval: false, // Off by default unless enabled
          isActive: false,
        },
      ];

      for (const wf of defaultWorkflows) {
        await ApprovalWorkflow.findOneAndUpdate(
          { workflowType: wf.workflowType },
          { $setOnInsert: wf },
          { upsert: true, new: true }
        );
      }

      // 4. Ensure Super Admin team member mapping
      let superAdminUser = await User.findOne({ email: 'admin@bundlebyte.com' });
      if (!superAdminUser) {
        superAdminUser = await User.findOne({ role: 'super_admin' });
      }
      if (superAdminUser) {
        if (superAdminUser.role !== 'super_admin') {
          superAdminUser.role = 'super_admin';
          await superAdminUser.save();
        }
        const superAdminRole = await TeamRole.findOne({ slug: 'super_admin' });
        const adminDept = await Department.findOne({ slug: 'administration' });
        if (superAdminRole) {
          await TeamMember.findOneAndUpdate(
            { user: superAdminUser._id },
            {
              $set: {
                user: superAdminUser._id,
                employeeCode: 'BB-EMP-001',
                jobTitle: 'Chief Executive Officer / Owner',
                department: adminDept?._id || null,
                roles: [superAdminRole._id],
                status: 'active',
              },
            },
            { upsert: true, new: true }
          );
        }
      }
    } catch (err) {
      console.error('Error during RBAC seeding:', err.message);
    }
  }

  /**
   * Resolves the full effective permission set for a given user.
   * Follows the 5-step evaluation hierarchy:
   * 1. Account & Session Security
   * 2. Explicit Deny Overrides (top priority)
   * 3. Role Permissions (union across all assigned roles)
   * 4. Explicit Allow Overrides (scoped additions)
   * 5. Default Deny
   */
  async getUserEffectivePermissions(userId) {
    const user = await User.findById(userId);
    if (!user) {
      return { allowed: [], denied: [], isSuperAdmin: false, status: 'not_found' };
    }

    if (user.isBanned || user.isSuspended || !user.isActive) {
      return { allowed: [], denied: ['*'], isSuperAdmin: false, status: 'locked' };
    }

    // Check if user is Super Admin
    if (user.role === 'super_admin') {
      return {
        allowed: ['*'],
        denied: [],
        isSuperAdmin: true,
        status: 'active',
        roles: ['super_admin'],
        user,
      };
    }

    const teamMember = await TeamMember.findOne({ user: userId })
      .populate('roles')
      .populate('department');

    if (teamMember && (teamMember.status === 'suspended' || teamMember.status === 'deactivated')) {
      return { allowed: [], denied: ['*'], isSuperAdmin: false, status: 'suspended' };
    }

    const allowSet = new Set();
    const denySet = new Set();
    const assignedRoles = [];

    // Collect permissions from teamMember roles
    if (teamMember && teamMember.roles && teamMember.roles.length > 0) {
      for (const role of teamMember.roles) {
        if (role.permissions && Array.isArray(role.permissions)) {
          assignedRoles.push(role.slug);
          role.permissions.forEach((perm) => allowSet.add(perm));
        }
      }
    } else {
      // Fallback: If no TeamMember doc exists, map from user.role if matching a system role
      const systemRole = await TeamRole.findOne({ slug: user.role });
      if (systemRole && systemRole.permissions) {
        assignedRoles.push(systemRole.slug);
        systemRole.permissions.forEach((perm) => allowSet.add(perm));
      }
    }

    // Apply direct permission overrides from TeamMember
    if (teamMember && teamMember.directPermissionOverrides) {
      for (const override of teamMember.directPermissionOverrides) {
        if (override.effect === 'deny') {
          denySet.add(override.permissionKey);
          allowSet.delete(override.permissionKey);
        } else if (override.effect === 'allow') {
          allowSet.add(override.permissionKey);
        }
      }
    }

    return {
      allowed: Array.from(allowSet),
      denied: Array.from(denySet),
      isSuperAdmin: false,
      status: 'active',
      roles: assignedRoles,
      teamMember,
      user,
    };
  }

  /**
   * Fast synchronous verification of whether a resolved permission set allows a given permission key.
   * Supports global wildcard ('*') and module wildcards ('products.*').
   */
  hasPermission(effectivePermissions, permissionKey) {
    if (!effectivePermissions || effectivePermissions.status !== 'active') {
      return false;
    }

    if (effectivePermissions.isSuperAdmin) {
      return true;
    }

    const { allowed = [], denied = [] } = effectivePermissions;

    const [module, action] = permissionKey.split('.');
    const moduleWildcard = `${module}.*`;

    // 1. Explicit Deny Check (Takes precedence over everything)
    if (denied.includes('*') || denied.includes(moduleWildcard) || denied.includes(permissionKey)) {
      return false;
    }

    // 2. Allow Check
    if (allowed.includes('*') || allowed.includes(moduleWildcard) || allowed.includes(permissionKey)) {
      return true;
    }

    // 3. Default Deny
    return false;
  }

  /**
   * Prevents Privilege Escalation:
   * Ensures an acting administrator cannot assign any permission to a role or user
   * that they themselves do not possess.
   */
  async checkPrivilegeEscalation(actingUserId, targetPermissions = []) {
    const actingPerms = await this.getUserEffectivePermissions(actingUserId);
    if (actingPerms.isSuperAdmin) {
      return { allowed: true };
    }

    const unauthorizedPermissions = [];
    for (const perm of targetPermissions) {
      if (!this.hasPermission(actingPerms, perm)) {
        unauthorizedPermissions.push(perm);
      }
    }

    if (unauthorizedPermissions.length > 0) {
      return {
        allowed: false,
        message: `Privilege escalation rejected: You cannot grant permissions you do not possess (${unauthorizedPermissions.join(', ')}).`,
        unauthorizedPermissions,
      };
    }

    return { allowed: true };
  }

  /**
   * Protects the Owner / Super Admin role and users from being modified, deleted, or demoted.
   */
  protectOwnerRole(targetRoleOrSlug) {
    const slug = typeof targetRoleOrSlug === 'string' ? targetRoleOrSlug : targetRoleOrSlug?.slug;
    if (slug === 'super_admin' || targetRoleOrSlug?.isProtected) {
      throw new Error('Access denied: The Super Admin / Owner role is protected and cannot be modified or deleted.');
    }
  }

  /**
   * Checks if an action triggers an approval workflow based on thresholds.
   */
  async checkApprovalRequired(workflowType, amount = 0) {
    const workflow = await ApprovalWorkflow.findOne({ workflowType, isActive: true });
    if (!workflow || !workflow.requiresApproval) {
      return { required: false };
    }

    if (workflow.thresholdAmount > 0 && amount < workflow.thresholdAmount) {
      return { required: false, threshold: workflow.thresholdAmount };
    }

    return {
      required: true,
      workflow,
      threshold: workflow.thresholdAmount,
    };
  }

  /**
   * Records an immutable audit log entry for RBAC and team events.
   */
  async recordAuditLog({
    actor,
    actorEmail = 'system',
    actorRole = 'system',
    action,
    entity,
    entityId = '',
    details = {},
    severity = SENSITIVITY_LEVELS.LOW,
    ipAddress = '',
    userAgent = '',
  }) {
    try {
      return await AuditLog.create({
        actor,
        actorEmail,
        actorRole,
        action,
        entity,
        entityId,
        details,
        severity,
        ipAddress,
        userAgent,
      });
    } catch (err) {
      console.error('Failed to create audit log:', err.message);
    }
  }
}

export const rbacService = new RBACService();
export default rbacService;
