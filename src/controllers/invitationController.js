import crypto from 'crypto';
import TeamInvitation from '../models/TeamInvitation.js';
import TeamRole from '../models/TeamRole.js';
import TeamMember from '../models/TeamMember.js';
import User from '../models/User.js';
import { sendEmail } from '../config/mailer.js';
import { sendTokenResponse } from '../middleware/auth.js';
import rbacService from '../services/rbacService.js';
import { ENV } from '../config/environment.js';
import { SENSITIVITY_LEVELS } from '../constants/permissionsRegistry.js';

/**
 * Helper to hash an invitation raw token with SHA-256
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * @desc List all team invitations
 * @route GET /api/admin/invitations
 */
export const listInvitations = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const invitations = await TeamInvitation.find(filter)
      .populate('role', 'name slug description')
      .populate('department', 'name slug')
      .populate('reportingManager', 'name email')
      .populate('invitedBy', 'name email')
      .populate('acceptedUser', 'name email avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      invitations,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Create & send a new team invitation
 * @route POST /api/admin/invitations
 */
export const createInvitation = async (req, res) => {
  try {
    const { email, name, roleId, departmentId, jobTitle, reportingManagerId } = req.body;

    if (!email || !name || !roleId) {
      return res.status(400).json({
        success: false,
        message: 'Email, full name, and role are required for team invitation.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if role exists
    const role = await TeamRole.findById(roleId);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Assigned role does not exist.' });
    }

    // Privilege escalation check: Caller cannot invite someone into a role having higher perms than caller
    const escalationCheck = await rbacService.checkPrivilegeEscalation(req.user._id, role.permissions);
    if (!escalationCheck.allowed) {
      return res.status(403).json({ success: false, message: escalationCheck.message });
    }

    // Check if there is already an active pending invitation for this email
    const existingPending = await TeamInvitation.findOne({
      email: cleanEmail,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: `An active pending invitation for '${cleanEmail}' already exists. Resend or cancel it first.`,
      });
    }

    // Check if user is already an active team member
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      const activeMember = await TeamMember.findOne({ user: existingUser._id, status: 'active' });
      if (activeMember) {
        return res.status(400).json({
          success: false,
          message: `User '${cleanEmail}' is already an active team member. Edit their roles directly.`,
        });
      }
    }

    // Generate secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiration

    const invitation = await TeamInvitation.create({
      email: cleanEmail,
      name: name.trim(),
      role: role._id,
      department: departmentId || null,
      jobTitle: jobTitle || 'Team Member',
      reportingManager: reportingManagerId || null,
      tokenHash,
      expiresAt,
      status: 'pending',
      invitedBy: req.user._id,
    });

    const inviteUrl = `${ENV.CLIENT_URL || 'http://localhost:5173'}/accept-invitation/${rawToken}`;

    // Dispatch email notification
    try {
      await sendEmail({
        to: cleanEmail,
        subject: `You've been invited to join the BundleByte Team as ${role.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f172a;">Welcome to the BundleByte Team!</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p><strong>${req.user.name}</strong> has invited you to join the team as <strong>${role.name}</strong>.</p>
            <div style="margin: 24px 0;">
              <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Accept Invitation & Set Password
              </a>
            </div>
            <p style="font-size: 13px; color: #64748b;">Or copy and paste this link into your browser:<br/><a href="${inviteUrl}">${inviteUrl}</a></p>
            <p style="font-size: 13px; color: #94a3b8;">This invitation link will expire in 7 days.</p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.warn('Failed to send invitation email (SMTP not configured or offline):', mailErr.message);
    }

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'TEAM_INVITATION_SENT',
      entity: 'TeamInvitation',
      entityId: invitation._id.toString(),
      details: { email: cleanEmail, role: role.name, roleSlug: role.slug },
      severity: SENSITIVITY_LEVELS.HIGH,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(201).json({
      success: true,
      message: `Invitation successfully sent to ${cleanEmail}`,
      invitation,
      rawToken, // Provided in development for easy testing
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Resend an existing invitation with fresh token and expiry
 * @route POST /api/admin/invitations/:id/resend
 */
export const resendInvitation = async (req, res) => {
  try {
    const invitation = await TeamInvitation.findById(req.params.id).populate('role');
    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (invitation.status === 'accepted') {
      return res.status(400).json({ success: false, message: 'This invitation has already been accepted.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    invitation.tokenHash = hashToken(rawToken);
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    invitation.status = 'pending';
    await invitation.save();

    const inviteUrl = `${ENV.CLIENT_URL || 'http://localhost:5173'}/accept-invitation/${rawToken}`;

    try {
      await sendEmail({
        to: invitation.email,
        subject: `Reminder: Join the BundleByte Team as ${invitation.role?.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f172a;">Your Invitation to BundleByte Team</h2>
            <p>Hello <strong>${invitation.name}</strong>,</p>
            <p>Your invitation has been refreshed. Click below to complete your team account setup:</p>
            <div style="margin: 24px 0;">
              <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            <p style="font-size: 13px; color: #64748b;"><a href="${inviteUrl}">${inviteUrl}</a></p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.warn('Failed to resend email:', mailErr.message);
    }

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'TEAM_INVITATION_RESENT',
      entity: 'TeamInvitation',
      entityId: invitation._id.toString(),
      details: { email: invitation.email },
      severity: SENSITIVITY_LEVELS.LOW,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: `Invitation resent to ${invitation.email}`,
      rawToken,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Cancel a pending invitation
 * @route POST /api/admin/invitations/:id/cancel
 */
export const cancelInvitation = async (req, res) => {
  try {
    const invitation = await TeamInvitation.findById(req.params.id);
    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (invitation.status === 'accepted') {
      return res.status(400).json({ success: false, message: 'Cannot cancel an already accepted invitation.' });
    }

    invitation.status = 'cancelled';
    await invitation.save();

    await rbacService.recordAuditLog({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'TEAM_INVITATION_CANCELLED',
      entity: 'TeamInvitation',
      entityId: invitation._id.toString(),
      details: { email: invitation.email },
      severity: SENSITIVITY_LEVELS.LOW,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: 'Invitation cancelled successfully',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Public: Validate invitation token and inspect metadata
 * @route GET /api/auth/team-invitation/verify/:token
 */
export const getInvitationByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);

    const invitation = await TeamInvitation.findOne({
      tokenHash,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .populate('role', 'name slug description')
      .populate('department', 'name slug');

    if (!invitation) {
      return res.status(400).json({
        success: false,
        message: 'Invalid, expired, or cancelled invitation token.',
      });
    }

    return res.status(200).json({
      success: true,
      invitation: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        department: invitation.department,
        jobTitle: invitation.jobTitle,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Public: Accept team invitation, set password, and activate account
 * @route POST /api/auth/team-invitation/accept
 */
export const acceptInvitation = async (req, res) => {
  try {
    const { token, password, name } = req.body;
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token and password are required.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    const tokenHash = hashToken(token);
    const invitation = await TeamInvitation.findOne({
      tokenHash,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).populate('role');

    if (!invitation) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired invitation token. Please request a new invitation.',
      });
    }

    // Find or create User
    let user = await User.findOne({ email: invitation.email });
    if (!user) {
      user = new User({
        name: name || invitation.name,
        email: invitation.email,
        password,
        role: invitation.role?.slug || 'admin',
        isActive: true,
        isEmailVerified: true,
        registrationMethod: 'admin',
        authProviders: ['local'],
      });
    } else {
      user.password = password;
      user.role = invitation.role?.slug || user.role;
      user.isActive = true;
      user.isSuspended = false;
      user.isEmailVerified = true;
      if (!user.authProviders.includes('local')) {
        user.authProviders.push('local');
      }
    }
    await user.save();

    // Create or update TeamMember record
    let member = await TeamMember.findOne({ user: user._id });
    if (!member) {
      const memberCount = await TeamMember.countDocuments();
      member = new TeamMember({
        user: user._id,
        employeeCode: `BB-EMP-${String(memberCount + 1).padStart(3, '0')}`,
        jobTitle: invitation.jobTitle || 'Team Member',
        department: invitation.department,
        roles: [invitation.role._id],
        reportingManager: invitation.reportingManager,
        status: 'active',
      });
    } else {
      member.status = 'active';
      member.department = invitation.department || member.department;
      member.jobTitle = invitation.jobTitle || member.jobTitle;
      if (!member.roles.includes(invitation.role._id)) {
        member.roles.push(invitation.role._id);
      }
    }
    await member.save();

    // Mark invitation accepted
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    invitation.acceptedUser = user._id;
    await invitation.save();

    await rbacService.recordAuditLog({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'TEAM_INVITATION_ACCEPTED',
      entity: 'TeamMember',
      entityId: member._id.toString(),
      details: { email: user.email, role: invitation.role?.name },
      severity: SENSITIVITY_LEVELS.HIGH,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return sendTokenResponse(user, 200, res, 'Team invitation accepted successfully! Welcome to the team.');
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

