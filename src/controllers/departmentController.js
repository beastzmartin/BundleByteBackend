import Department from '../models/Department.js';
import TeamMember from '../models/TeamMember.js';
import rbacService from '../services/rbacService.js';
import { SENSITIVITY_LEVELS } from '../constants/permissionsRegistry.js';

/**
 * @desc List all departments with manager and member counts
 * @route GET /api/admin/departments
 */
export const listDepartments = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('manager', 'name email avatar role')
      .populate('parentDepartment', 'name slug')
      .sort({ name: 1 });

    const memberCounts = await TeamMember.aggregate([
      { $match: { department: { $ne: null } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    memberCounts.forEach((item) => {
      countMap[item._id.toString()] = item.count;
    });

    const enriched = departments.map((dept) => ({
      ...dept.toObject(),
      memberCount: countMap[dept._id.toString()] || 0,
    }));

    return res.status(200).json({
      success: true,
      departments: enriched,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Get department hierarchy tree
 * @route GET /api/admin/departments/hierarchy
 */
export const getHierarchy = async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true })
      .populate('manager', 'name email avatar jobTitle')
      .lean();

    const members = await TeamMember.find({ status: { $in: ['active', 'invited'] } })
      .populate('user', 'name email avatar role isSuspended')
      .populate('roles', 'name slug')
      .populate('reportingManager', 'name email avatar')
      .lean();

    // Map members into department buckets
    const deptMembersMap = {};
    members.forEach((m) => {
      const deptId = m.department ? m.department.toString() : 'unassigned';
      if (!deptMembersMap[deptId]) deptMembersMap[deptId] = [];
      deptMembersMap[deptId].push(m);
    });

    // Build hierarchy tree
    const rootDepartments = departments.filter((d) => !d.parentDepartment);
    const buildTree = (parentDept) => {
      const children = departments.filter(
        (d) => d.parentDepartment && d.parentDepartment.toString() === parentDept._id.toString()
      );
      return {
        ...parentDept,
        members: deptMembersMap[parentDept._id.toString()] || [],
        subDepartments: children.map(buildTree),
      };
    };

    const tree = rootDepartments.map(buildTree);

    return res.status(200).json({
      success: true,
      hierarchy: tree,
      unassignedMembers: deptMembersMap['unassigned'] || [],
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Create a new department
 * @route POST /api/admin/departments
 */
export const createDepartment = async (req, res) => {
  try {
    const { name, slug, description, manager, parentDepartment } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Department name is required' });
    }

    const deptSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '_')).trim();
    const existing = await Department.findOne({ slug: deptSlug });
    if (existing) {
      return res.status(400).json({ success: false, message: `Department with slug '${deptSlug}' already exists.` });
    }

    const department = await Department.create({
      name,
      slug: deptSlug,
      description: description || '',
      manager: manager || null,
      parentDepartment: parentDepartment || null,
      isActive: true,
    });

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'DEPARTMENT_CREATED',
      entity: 'Department',
      entityId: department._id.toString(),
      details: { name, slug: deptSlug },
      severity: SENSITIVITY_LEVELS.MEDIUM,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Department created successfully',
      department,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Update a department
 * @route PUT /api/admin/departments/:id
 */
export const updateDepartment = async (req, res) => {
  try {
    const { name, description, manager, parentDepartment, isActive } = req.body;
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    if (name) department.name = name;
    if (description !== undefined) department.description = description;
    if (manager !== undefined) department.manager = manager || null;
    if (parentDepartment !== undefined) department.parentDepartment = parentDepartment || null;
    if (isActive !== undefined) department.isActive = isActive;

    await department.save();

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'DEPARTMENT_UPDATED',
      entity: 'Department',
      entityId: department._id.toString(),
      details: { name: department.name, slug: department.slug },
      severity: SENSITIVITY_LEVELS.MEDIUM,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      department,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Delete an unused department
 * @route DELETE /api/admin/departments/:id
 */
export const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    const assignedCount = await TeamMember.countDocuments({ department: department._id });
    if (assignedCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department '${department.name}'. ${assignedCount} team member(s) are currently assigned. Reassign them first.`,
      });
    }

    await Department.findByIdAndDelete(department._id);

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'DEPARTMENT_DELETED',
      entity: 'Department',
      entityId: department._id.toString(),
      details: { name: department.name, slug: department.slug },
      severity: SENSITIVITY_LEVELS.HIGH,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: `Department '${department.name}' deleted successfully`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

