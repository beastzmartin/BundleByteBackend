import rbacService from '../services/rbacService.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import { SENSITIVITY_LEVELS } from '../constants/permissionsRegistry.js';

/**
 * Middleware: Enforces that the authenticated user possesses the specified permission.
 * Uses the 5-step evaluation hierarchy (Session -> Explicit Deny -> Roles -> Explicit Allow -> Default Deny).
 *
 * @param {string} permissionKey - e.g. 'products.create', 'orders.refund', 'team_management.manage'
 */
export const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to verify permissions.',
        });
      }

      const effectivePerms = await rbacService.getUserEffectivePermissions(req.user._id);

      if (effectivePerms.status === 'locked' || effectivePerms.status === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Your account or team membership has been suspended.',
        });
      }

      const hasAccess = rbacService.hasPermission(effectivePerms, permissionKey);

      if (!hasAccess) {
        // Record security audit event for unauthorized attempt
        await rbacService.recordAuditLog({
          actor: req.user._id,
          actorEmail: req.user.email,
          actorRole: req.user.role,
          action: 'ACCESS_DENIED_PERMISSION_CHECK',
          entity: 'RBAC_SECURITY',
          entityId: permissionKey,
          details: {
            requiredPermission: permissionKey,
            path: req.originalUrl,
            method: req.method,
            userRoles: effectivePerms.roles,
          },
          severity: SENSITIVITY_LEVELS.HIGH,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
          userAgent: req.headers['user-agent'] || '',
        });

        return res.status(403).json({
          success: false,
          message: `Access denied: You lack the required permission (${permissionKey}).`,
          requiredPermission: permissionKey,
        });
      }

      req.effectivePermissions = effectivePerms;
      req.teamMember = effectivePerms.teamMember;
      next();
    } catch (err) {
      console.error('RBAC middleware error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal authorization error.',
        error: err.message,
      });
    }
  };
};

/**
 * Middleware: Restricts access strictly to Super Admin / Organization Owner.
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Exclusive Super Administrator / Owner authority required.',
    });
  }
  next();
};

/**
 * Middleware: Checks if an action requires approval (e.g. refunds > threshold, wallet adjustments).
 * If threshold is exceeded, creates an ApprovalRequest and returns a pending response unless already approved.
 */
export const checkApprovalWorkflow = (workflowType, amountResolver) => {
  return async (req, res, next) => {
    try {
      // If Super Admin, bypass approval workflows
      if (req.user && req.user.role === 'super_admin') {
        return next();
      }

      const amount = typeof amountResolver === 'function' ? amountResolver(req) : Number(req.body.amount || 0);
      const approvalCheck = await rbacService.checkApprovalRequired(workflowType, amount);

      if (approvalCheck.required) {
        // If an approvalId was passed and is already verified, proceed
        if (req.body.approvalRequestId) {
          const existingApproval = await ApprovalRequest.findById(req.body.approvalRequestId);
          if (existingApproval && existingApproval.status === 'approved' && !existingApproval.appliedAt) {
            req.verifiedApprovalRequest = existingApproval;
            return next();
          }
        }

        // Otherwise create an approval request and halt direct execution
        const newRequest = await ApprovalRequest.create({
          workflowType,
          title: `${workflowType.replace(/_/g, ' ').toUpperCase()} Authorization`,
          description: `Action initiated by ${req.user.name} (${req.user.email}) for amount: ${amount}`,
          requester: req.user._id,
          amount,
          currency: req.body.currency || 'USD',
          targetEntity: req.body.targetEntity || workflowType,
          targetId: req.body.targetId || req.params.id || '',
          payload: {
            body: req.body,
            params: req.params,
            query: req.query,
          },
          status: 'pending',
        });

        await rbacService.recordAuditLog({
          actor: req.user._id,
          actorEmail: req.user.email,
          actorRole: req.user.role,
          action: 'APPROVAL_REQUEST_SUBMITTED',
          entity: 'ApprovalRequest',
          entityId: newRequest._id.toString(),
          details: { workflowType, amount, targetId: newRequest.targetId },
          severity: SENSITIVITY_LEVELS.MEDIUM,
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        });

        return res.status(202).json({
          success: true,
          approvalRequired: true,
          message: `This action requires approval because it exceeds the threshold of $${approvalCheck.threshold}. A request has been queued for manager authorization.`,
          approvalRequest: newRequest,
        });
      }

      next();
    } catch (err) {
      console.error('Approval workflow error:', err);
      next(err);
    }
  };
};

/**
 * Middleware: Blocks a user from approving or rejecting their own approval requests.
 */
export const preventSelfApproval = (req, res, next) => {
  const approvalRequest = req.targetApprovalRequest;
  if (!approvalRequest) return next();

  if (approvalRequest.requester.toString() === req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Self-approval violation: You cannot approve or reject your own request.',
    });
  }
  next();
};

