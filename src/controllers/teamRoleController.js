import TeamRole from '../models/TeamRole.js';
import TeamMember from '../models/TeamMember.js';
import rbacService from '../services/rbacService.js';
import {
  PERMISSIONS_LIST,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  SENSITIVITY_LEVELS,
} from '../constants/permissionsRegistry.js';

/**
 * @desc Get all permissions and modules registry
 * @route GET /api/admin/roles/permissions-registry
 */
export const getPermissionsRegistry = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      modules: PERMISSION_MODULES,
      actions: PERMISSION_ACTIONS,
      permissions: PERMISSIONS_LIST,
      sensitivityLevels: SENSITIVITY_LEVELS,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc List all roles with member counts
 * @route GET /api/admin/roles
 */
export const listRoles = async (req, res) => {
  try {
    const roles = await TeamRole.find().sort({ isProtected: -1, isSystemRole: -1, createdAt: 1 });

    // Aggregate member count for each role
    const memberCounts = await TeamMember.aggregate([
      { $unwind: '$roles' },
      { $group: { _id: '$roles', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    memberCounts.forEach((item) => {
      countMap[item._id.toString()] = item.count;
    });

    const rolesWithCounts = roles.map((role) => ({
      ...role.toObject(),
      memberCount: countMap[role._id.toString()] || 0,
    }));

    return res.status(200).json({
      success: true,
      roles: rolesWithCounts,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Get single role by ID
 * @route GET /api/admin/roles/:id
 */
export const getRoleById = async (req, res) => {
  try {
    const role = await TeamRole.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    const members = await TeamMember.find({ roles: role._id })
      .populate('user', 'name email avatar role')
      .populate('department', 'name');

    return res.status(200).json({
      success: true,
      role,
      members,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Create a new custom role
 * @route POST /api/admin/roles
 */
export const createRole = async (req, res) => {
  try {
    const { name, slug, description, permissions, department } = req.body;

    if (!name || !permissions) {
      return res.status(400).json({ success: false, message: 'Role name and permissions are required' });
    }

    const roleSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '_')).trim();

    // Check slug uniqueness
    const existing = await TeamRole.findOne({ slug: roleSlug });
    if (existing) {
      return res.status(400).json({ success: false, message: `Role with slug '${roleSlug}' already exists.` });
    }

    // Privilege escalation check: Caller cannot assign permissions they don't possess
    const escalationCheck = await rbacService.checkPrivilegeEscalation(req.user._id, permissions);
    if (!escalationCheck.allowed) {
      return res.status(403).json({ success: false, message: escalationCheck.message });
    }

    const newRole = await TeamRole.create({
      name,
      slug: roleSlug,
      description: description || '',
      permissions,
      department: department || null,
      isSystemRole: false,
      isProtected: false,
      createdBy: req.user._id,
    });

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ROLE_CREATED',
      entity: 'TeamRole',
      entityId: newRole._id.toString(),
      details: { name, slug: roleSlug, permissionsCount: permissions.length },
      severity: SENSITIVITY_LEVELS.HIGH,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Custom role created successfully',
      role: newRole,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Update an existing role
 * @route PUT /api/admin/roles/:id
 */
export const updateRole = async (req, res) => {
  try {
    const role = await TeamRole.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Protect Super Admin / Owner role
    if (role.isProtected || role.slug === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'The Super Admin / Owner role is protected and cannot be altered.',
      });
    }

    const { name, description, permissions, department } = req.body;

    // Privilege escalation check
    if (permissions && Array.isArray(permissions)) {
      const escalationCheck = await rbacService.checkPrivilegeEscalation(req.user._id, permissions);
      if (!escalationCheck.allowed) {
        return res.status(403).json({ success: false, message: escalationCheck.message });
      }
      role.permissions = permissions;
    }

    if (name) role.name = name;
    if (description !== undefined) role.description = description;
    if (department !== undefined) role.department = department || null;

    await role.save();

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ROLE_UPDATED',
      entity: 'TeamRole',
      entityId: role._id.toString(),
      details: { name: role.name, slug: role.slug, permissionsCount: role.permissions.length },
      severity: SENSITIVITY_LEVELS.HIGH,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      role,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Duplicate an existing role
 * @route POST /api/admin/roles/:id/duplicate
 */
export const duplicateRole = async (req, res) => {
  try {
    const sourceRole = await TeamRole.findById(req.params.id);
    if (!sourceRole) {
      return res.status(404).json({ success: false, message: 'Source role not found' });
    }

    const { name, slug } = req.body;
    const newName = name || `${sourceRole.name} (Copy)`;
    const newSlug = (slug || `${sourceRole.slug}_copy_${Date.now()}`).toLowerCase().trim();

    // Privilege escalation check on source permissions
    const escalationCheck = await rbacService.checkPrivilegeEscalation(req.user._id, sourceRole.permissions);
    if (!escalationCheck.allowed) {
      return res.status(403).json({ success: false, message: escalationCheck.message });
    }

    const duplicatedRole = await TeamRole.create({
      name: newName,
      slug: newSlug,
      description: `Cloned from ${sourceRole.name}. ${sourceRole.description}`,
      permissions: [...sourceRole.permissions],
      department: sourceRole.department,
      isSystemRole: false,
      isProtected: false,
      createdBy: req.user._id,
    });

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ROLE_DUPLICATED',
      entity: 'TeamRole',
      entityId: duplicatedRole._id.toString(),
      details: { sourceRole: sourceRole.slug, newRole: newSlug },
      severity: SENSITIVITY_LEVELS.MEDIUM,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Role duplicated successfully',
      role: duplicatedRole,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Delete an unused custom role
 * @route DELETE /api/admin/roles/:id
 */
export const deleteRole = async (req, res) => {
  try {
    const role = await TeamRole.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Protect Super Admin or system-locked roles
    if (role.isProtected || role.slug === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'The Super Admin / Owner role is protected and cannot be deleted.',
      });
    }

    // Cannot delete if members are currently assigned
    const assignedCount = await TeamMember.countDocuments({ roles: role._id });
    if (assignedCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role '${role.name}'. It is currently assigned to ${assignedCount} active team member(s). Reassign them first.`,
      });
    }

    await TeamRole.findByIdAndDelete(role._id);

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ROLE_DELETED',
      entity: 'TeamRole',
      entityId: role._id.toString(),
      details: { name: role.name, slug: role.slug },
      severity: SENSITIVITY_LEVELS.HIGH,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: `Role '${role.name}' deleted successfully`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

