import WebsiteAuditLog from '../models/WebsiteAuditLog.js';

export const requireWebsitePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access Website Control Center',
      });
    }

    const { role, websitePermissions = [] } = req.user;

    // Super Admin & Admin have unrestricted access
    if (role === 'super_admin' || role === 'admin') {
      return next();
    }

    // Website Manager permission grants access to all website features
    if (websitePermissions.includes('website_manager')) {
      return next();
    }

    // Check specific module permission
    if (requiredPermission && websitePermissions.includes(requiredPermission)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Permission denied: '${requiredPermission || 'website_manager'}' privilege is required to perform this action.`,
    });
  };
};

export const logWebsiteChange = async ({
  req,
  action,
  module,
  entityId = '',
  description = '',
  changes = {},
}) => {
  try {
    const ipAddress =
      req?.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      '';
    const userAgent = req?.headers['user-agent'] || '';

    await WebsiteAuditLog.create({
      actor: req?.user?._id || null,
      actorEmail: req?.user?.email || 'system',
      actorRole: req?.user?.role || 'system',
      action,
      module,
      entityId: String(entityId),
      description,
      changes,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Failed to log website audit entry:', error);
  }
};

