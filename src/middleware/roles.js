const ROLE_HIERARCHY = {
  super_admin: ['super_admin', 'admin', 'manager', 'inventory_manager', 'support_agent', 'customer'],
  admin: ['admin', 'manager', 'inventory_manager', 'support_agent', 'customer'],
  manager: ['manager', 'support_agent', 'customer'],
  inventory_manager: ['inventory_manager', 'customer'],
  support_agent: ['support_agent', 'customer'],
  customer: ['customer'],
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role;

    // Check direct match
    if (roles.includes(userRole)) {
      return next();
    }

    // Check hierarchy: if user has higher role that includes required role
    const inheritedRoles = ROLE_HIERARCHY[userRole] || [];
    const hasPermission = roles.some((r) => inheritedRoles.includes(r));

    if (hasPermission) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `User role '${userRole}' is not authorized to access this resource`,
    });
  };
};

export const canManageFinances = (req, res, next) => {
  if (!req.user || !['super_admin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Sensitive financial operations are restricted to Admin personnel only.',
    });
  }
  next();
};

export const canManageCredentials = (req, res, next) => {
  if (!req.user || !['super_admin', 'admin', 'inventory_manager'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access to decrypt or modify digital inventory credentials is denied.',
    });
  }
  next();
};
