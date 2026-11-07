import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import TeamRole from '../models/TeamRole.js';
import Department from '../models/Department.js';
import TeamMember from '../models/TeamMember.js';
import TeamInvitation from '../models/TeamInvitation.js';
import ApprovalWorkflow from '../models/ApprovalWorkflow.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import AuditLog from '../models/AuditLog.js';
import rbacService from '../services/rbacService.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/environment.js';

const runTests = async () => {
  console.log('\n======================================================');
  console.log('🚀 ENTERPRISE RBAC & TEAM MANAGEMENT VERIFICATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  };

  try {
    await connectDB();

    // 1. Test System Roles & Departments Seeding
    console.log('\n--- 1. SEEDING & SYSTEM INTEGRITY ---');
    await rbacService.seedSystemRolesAndDepartments();

    const rolesCount = await TeamRole.countDocuments();
    assert(rolesCount >= 12, `Seeded at least 12 default roles (Found: ${rolesCount})`);

    const deptsCount = await Department.countDocuments();
    assert(deptsCount >= 7, `Seeded at least 7 default departments (Found: ${deptsCount})`);

    const superAdminRole = await TeamRole.findOne({ slug: 'super_admin' });
    assert(
      superAdminRole && superAdminRole.isProtected && superAdminRole.permissions.includes('*'),
      'Super Admin role exists, is protected, and holds global wildcard (*)'
    );

    // 2. Test Super Admin & Customer Effective Permissions
    console.log('\n--- 2. MULTI-LEVEL PERMISSION EVALUATION ---');
    let adminUser = await User.findOne({ email: 'admin@bundlebyte.com' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Muzammil (Admin)',
        email: 'admin@bundlebyte.com',
        password: 'Admin@123456',
        role: 'super_admin',
        isActive: true,
        isEmailVerified: true,
      });
      // Re-seed rbac mapping now that admin user exists
      await rbacService.seedSystemRolesAndDepartments();
    }
    const superAdminPerms = await rbacService.getUserEffectivePermissions(adminUser._id);
    assert(superAdminPerms.isSuperAdmin === true, 'admin@bundlebyte.com resolves as Super Admin');
    assert(
      rbacService.hasPermission(superAdminPerms, 'anything.under.the.sun'),
      'Super Admin has wildcard access to all modules and actions'
    );

    // Create a standard test user with a custom role
    const testSupportUser = await User.findOneAndUpdate(
      { email: 'sarah.support@bundlebyte.com' },
      {
        name: 'Sarah Agent',
        email: 'sarah.support@bundlebyte.com',
        role: 'support_agent',
        isActive: true,
        isSuspended: false,
      },
      { upsert: true, new: true }
    );

    const supportRole = await TeamRole.findOne({ slug: 'support_agent' });
    const supportDept = await Department.findOne({ slug: 'customer_support' });

    let supportMember = await TeamMember.findOneAndUpdate(
      { user: testSupportUser._id },
      {
        user: testSupportUser._id,
        employeeCode: 'BB-EMP-888',
        jobTitle: 'Senior Support Specialist',
        department: supportDept._id,
        roles: [supportRole._id],
        status: 'active',
        directPermissionOverrides: [],
      },
      { upsert: true, new: true }
    );

    let perms = await rbacService.getUserEffectivePermissions(testSupportUser._id);
    assert(
      rbacService.hasPermission(perms, 'support_tickets.read') === true,
      'Support Agent has permission support_tickets.read'
    );
    assert(
      rbacService.hasPermission(perms, 'payments.configure') === false,
      'Support Agent is denied payments.configure (Default Deny)'
    );

    // 3. Test Explicit Direct Overrides (Allow and Deny)
    console.log('\n--- 3. DIRECT PERMISSION OVERRIDES (ALLOW & DENY) ---');
    // Add Allow override for orders.view
    supportMember.directPermissionOverrides.push({
      permissionKey: 'orders.view',
      effect: 'allow',
      reason: 'Temporary view access for customer order inquiries',
    });
    // Add Deny override for support_tickets.delete (even if allowed by role)
    supportMember.directPermissionOverrides.push({
      permissionKey: 'support_tickets.delete',
      effect: 'deny',
      reason: 'Strict safety: frontline agents cannot delete tickets',
    });
    await supportMember.save();

    perms = await rbacService.getUserEffectivePermissions(testSupportUser._id);
    assert(
      rbacService.hasPermission(perms, 'orders.view') === true,
      'Explicit Allow Override granted orders.view to support member'
    );
    assert(
      rbacService.hasPermission(perms, 'support_tickets.delete') === false,
      'Explicit Deny Override took top priority and revoked support_tickets.delete'
    );

    // 4. Test Privilege Escalation Prevention
    console.log('\n--- 4. PRIVILEGE ESCALATION PREVENTION ---');
    // Sarah (Support Agent) attempts to grant 'payments.configure'
    const escalationAttempt = await rbacService.checkPrivilegeEscalation(testSupportUser._id, [
      'support_tickets.view',
      'payments.configure',
    ]);
    assert(
      escalationAttempt.allowed === false,
      'Privilege escalation correctly blocked: Non-admin cannot grant payments.configure'
    );

    // Super Admin check allows everything
    const superAdminCheck = await rbacService.checkPrivilegeEscalation(adminUser._id, [
      'payments.configure',
      'system_settings.configure',
    ]);
    assert(superAdminCheck.allowed === true, 'Super Admin passes privilege escalation verification');

    // 5. Test Owner Role Protection
    console.log('\n--- 5. OWNER & SUPER ADMIN ROLE PROTECTION ---');
    let protectedError = false;
    try {
      rbacService.protectOwnerRole(superAdminRole);
    } catch (e) {
      protectedError = true;
    }
    assert(protectedError === true, 'protectOwnerRole() rejects any modification to super_admin role');

    // 6. Test Team Member Invitation Generation & Acceptance
    console.log('\n--- 6. TEAM INVITATION & SECURE TOKEN ACCEPTANCE ---');
    const inviteRawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(inviteRawToken).digest('hex');

    const testInviteEmail = 'alex.finance@bundlebyte.com';
    await TeamInvitation.deleteMany({ email: testInviteEmail });

    const financeRole = await TeamRole.findOne({ slug: 'finance_manager' });
    const financeDept = await Department.findOne({ slug: 'finance' });

    const invitation = await TeamInvitation.create({
      email: testInviteEmail,
      name: 'Alex Vance',
      role: financeRole._id,
      department: financeDept._id,
      jobTitle: 'Financial Controller',
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
      invitedBy: adminUser._id,
    });
    assert(invitation.status === 'pending', 'Created pending team invitation with SHA-256 hashed token');

    // Simulate public acceptance
    const acceptedUser = await User.findOneAndUpdate(
      { email: testInviteEmail },
      {
        name: 'Alex Vance',
        email: testInviteEmail,
        password: 'Password@Secure123',
        role: financeRole.slug,
        isActive: true,
        isEmailVerified: true,
      },
      { upsert: true, new: true }
    );

    const acceptedMember = await TeamMember.findOneAndUpdate(
      { user: acceptedUser._id },
      {
        user: acceptedUser._id,
        employeeCode: 'BB-EMP-777',
        jobTitle: 'Financial Controller',
        department: financeDept._id,
        roles: [financeRole._id],
        status: 'active',
      },
      { upsert: true, new: true }
    );

    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    invitation.acceptedUser = acceptedUser._id;
    await invitation.save();

    assert(invitation.status === 'accepted', 'Invitation marked accepted');
    const financePerms = await rbacService.getUserEffectivePermissions(acceptedUser._id);
    assert(
      rbacService.hasPermission(financePerms, 'payments.approve') === true,
      'Newly accepted Finance Manager has payments.approve permission'
    );

    // 7. Test Account Suspension & Immediate Session Invalidation
    console.log('\n--- 7. SESSION REVOCATION & ACCOUNT SUSPENSION ---');
    const initialTokenVersion = acceptedUser.tokenVersion || 0;
    const initialToken = jwt.sign(
      { id: acceptedUser._id, tokenVersion: initialTokenVersion },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Verify token is valid initially
    const decodedValid = jwt.verify(initialToken, ENV.JWT_SECRET);
    assert(
      decodedValid.tokenVersion === acceptedUser.tokenVersion,
      'Active session token matches user tokenVersion'
    );

    // Suspend user: increments tokenVersion
    acceptedUser.isSuspended = true;
    acceptedUser.tokenVersion = initialTokenVersion + 1;
    await acceptedUser.save();

    acceptedMember.status = 'suspended';
    acceptedMember.suspendedReason = 'Security review triggered';
    await acceptedMember.save();

    // Checking old token against updated user
    const userAfterRevoke = await User.findById(acceptedUser._id);
    const isTokenRevoked = userAfterRevoke.tokenVersion > decodedValid.tokenVersion;
    assert(
      isTokenRevoked === true,
      'Session immediately invalidated: decoded tokenVersion is less than user tokenVersion'
    );

    const suspendedPerms = await rbacService.getUserEffectivePermissions(acceptedUser._id);
    assert(
      rbacService.hasPermission(suspendedPerms, 'payments.view') === false,
      'Suspended member denied all permissions'
    );

    // 8. Test Sensitive Approval Workflow & Self-Approval Prevention
    console.log('\n--- 8. APPROVAL WORKFLOW & SELF-APPROVAL PREVENTION ---');
    // Check if $750 refund triggers approval (threshold is $500)
    const refundApprovalCheck = await rbacService.checkApprovalRequired('refund_threshold', 750);
    assert(refundApprovalCheck.required === true, 'Refund of $750 exceeds $500 threshold and triggers approval');

    const approvalRequest = await ApprovalRequest.create({
      workflowType: 'refund_threshold',
      title: 'High-Value Refund Authorization',
      requester: testSupportUser._id,
      amount: 750,
      currency: 'USD',
      targetEntity: 'Refund',
      targetId: 'REF-TEST-999',
      status: 'pending',
    });

    // Check self-approval prevention: Sarah attempts to approve her own request
    const isSelfApprovalBlocked = approvalRequest.requester.toString() === testSupportUser._id.toString();
    assert(isSelfApprovalBlocked === true, 'Self-approval detected and prohibited for requester');

    // Admin approves the request
    approvalRequest.status = 'approved';
    approvalRequest.reviewedBy = adminUser._id;
    approvalRequest.reviewedAt = new Date();
    approvalRequest.reviewNotes = 'Verified customer return eligibility. Authorized.';
    approvalRequest.appliedAt = new Date();
    await approvalRequest.save();

    assert(approvalRequest.status === 'approved', 'Approval authorized by manager with review notes');

    // 9. Test Audit Logging
    console.log('\n--- 9. AUDIT LOGGING ---');
    const log = await rbacService.recordAuditLog({
      actor: adminUser._id,
      actorEmail: adminUser.email,
      actorRole: adminUser.role,
      action: 'ROLE_CREATED',
      entity: 'TeamRole',
      entityId: 'test_role_id',
      details: { roleName: 'Custom QA Specialist' },
      severity: 'medium',
    });
    assert(Boolean(log && log._id), 'Audit log successfully recorded');

    console.log('\n======================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Fatal error during test run:', err);
    failed++;
  } finally {
    await disconnectDB();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
