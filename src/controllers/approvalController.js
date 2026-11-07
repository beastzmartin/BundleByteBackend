import ApprovalRequest from '../models/ApprovalRequest.js';
import ApprovalWorkflow from '../models/ApprovalWorkflow.js';
import rbacService from '../services/rbacService.js';
import { SENSITIVITY_LEVELS } from '../constants/permissionsRegistry.js';

/**
 * @desc List all approval requests
 * @route GET /api/admin/approvals
 */
export const listApprovals = async (req, res) => {
  try {
    const { status, workflowType } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (workflowType) filter.workflowType = workflowType;

    const requests = await ApprovalRequest.find(filter)
      .populate('requester', 'name email avatar role')
      .populate('reviewedBy', 'name email avatar role')
      .sort({ createdAt: -1 });

    const counts = {
      pending: await ApprovalRequest.countDocuments({ status: 'pending' }),
      approved: await ApprovalRequest.countDocuments({ status: 'approved' }),
      rejected: await ApprovalRequest.countDocuments({ status: 'rejected' }),
      total: await ApprovalRequest.countDocuments(),
    };

    return res.status(200).json({
      success: true,
      requests,
      counts,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Get details of a single approval request
 * @route GET /api/admin/approvals/:id
 */
export const getApprovalById = async (req, res) => {
  try {
    const approval = await ApprovalRequest.findById(req.params.id)
      .populate('requester', 'name email avatar role')
      .populate('reviewedBy', 'name email avatar role');

    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval request not found' });
    }

    return res.status(200).json({
      success: true,
      approval,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Review an approval request (Approve or Reject)
 * @route POST /api/admin/approvals/:id/review
 */
export const reviewApproval = async (req, res) => {
  try {
    const { decision, notes } = req.body; // decision: 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be either 'approved' or 'rejected'.",
      });
    }

    const approval = await ApprovalRequest.findById(req.params.id);
    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval request not found' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${approval.status}.`,
      });
    }

    // Strict self-approval prevention: Requester cannot approve or reject their own request
    if (approval.requester.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Self-approval violation: You cannot authorize or reject your own request.',
      });
    }

    approval.status = decision;
    approval.reviewedBy = req.user._id;
    approval.reviewedAt = new Date();
    approval.reviewNotes = notes || '';
    if (decision === 'approved') {
      approval.appliedAt = new Date();
    }
    await approval.save();

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: `APPROVAL_REQUEST_${decision.toUpperCase()}`,
      entity: 'ApprovalRequest',
      entityId: approval._id.toString(),
      details: {
        workflowType: approval.workflowType,
        targetEntity: approval.targetEntity,
        amount: approval.amount,
        decision,
        notes,
      },
      severity: SENSITIVITY_LEVELS.CRITICAL,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: `Approval request ${decision} successfully.`,
      approval,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc List configurable approval workflows and threshold policies
 * @route GET /api/admin/approvals/workflows
 */
export const listWorkflows = async (req, res) => {
  try {
    const workflows = await ApprovalWorkflow.find().populate('allowedApproverRoles', 'name slug');
    return res.status(200).json({
      success: true,
      workflows,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Update an approval workflow policy (threshold, enabled state)
 * @route PUT /api/admin/approvals/workflows/:id
 */
export const updateWorkflow = async (req, res) => {
  try {
    const { thresholdAmount, isActive, requiresApproval, name, description } = req.body;
    const workflow = await ApprovalWorkflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow policy not found' });
    }

    if (thresholdAmount !== undefined) workflow.thresholdAmount = Number(thresholdAmount);
    if (isActive !== undefined) workflow.isActive = Boolean(isActive);
    if (requiresApproval !== undefined) workflow.requiresApproval = Boolean(requiresApproval);
    if (name) workflow.name = name;
    if (description !== undefined) workflow.description = description;

    await workflow.save();

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'APPROVAL_WORKFLOW_UPDATED',
      entity: 'ApprovalWorkflow',
      entityId: workflow._id.toString(),
      details: { workflowType: workflow.workflowType, thresholdAmount: workflow.thresholdAmount },
      severity: SENSITIVITY_LEVELS.HIGH,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: 'Workflow policy updated successfully',
      workflow,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

