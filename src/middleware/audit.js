import AuditLog from '../models/AuditLog.js';

export const logAudit = async ({
  actor = null,
  actorEmail = 'system',
  actorRole = 'system',
  action,
  entity,
  entityId = '',
  details = {},
  req = null,
}) => {
  try {
    let ipAddress = '';
    let userAgent = '';

    if (req) {
      ipAddress = req.headers?.['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '';
      userAgent = req.headers?.['user-agent'] || '';
      if (!actor && req.user) {
        actor = req.user._id;
        actorEmail = req.user.email;
        actorRole = req.user.role;
      }
    }

    await AuditLog.create({
      actor,
      actorEmail,
      actorRole,
      action,
      entity,
      entityId,
      details,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error.message);
  }
};

