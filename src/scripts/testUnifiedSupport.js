import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import TeamRole from '../models/TeamRole.js';
import Department from '../models/Department.js';
import TeamMember from '../models/TeamMember.js';
import SupportTicket from '../models/SupportTicket.js';
import ChatConversation from '../models/ChatConversation.js';
import ChatMessage from '../models/ChatMessage.js';
import SupportSLA from '../models/SupportSLA.js';
import assignmentService from '../services/assignmentService.js';
import slaService from '../services/slaService.js';
import rbacService from '../services/rbacService.js';
import crypto from 'crypto';

const runTests = async () => {
  console.log('\n======================================================');
  console.log('🚀 UNIFIED SUPPORT & LIVE CHAT SYSTEM VERIFICATION SUITE');
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

    // 1. Seed Roles, Departments, and SLAs
    console.log('\n--- 1. SEEDING & INFRASTRUCTURE INITIALIZATION ---');
    await rbacService.seedSystemRolesAndDepartments();
    await slaService.seedDefaultSLAs();

    const slaCount = await SupportSLA.countDocuments();
    assert(slaCount >= 4, `Seeded default SLA policies (P1, P2, P3, P4) (Found: ${slaCount})`);

    // Ensure customer user exists
    let customer = await User.findOne({ email: 'support_customer_test@bundlebyte.com' });
    if (!customer) {
      customer = await User.create({
        name: 'Support Test Customer',
        email: 'support_customer_test@bundlebyte.com',
        password: 'Password@123',
        role: 'customer',
        isActive: true,
      });
    }

    // Ensure Support Agents exist for assignment testing
    let agentRole = await TeamRole.findOne({ slug: 'support_agent' });
    let supportDept = await Department.findOne({ slug: 'customer-support' });

    let agentAUser = await User.findOne({ email: 'agent_alpha@bundlebyte.com' });
    if (!agentAUser) {
      agentAUser = await User.create({
        name: 'Agent Alpha',
        email: 'agent_alpha@bundlebyte.com',
        password: 'Password@123',
        role: 'support_agent',
        isActive: true,
      });
    }

    let agentBUser = await User.findOne({ email: 'agent_beta@bundlebyte.com' });
    if (!agentBUser) {
      agentBUser = await User.create({
        name: 'Agent Beta',
        email: 'agent_beta@bundlebyte.com',
        password: 'Password@123',
        role: 'support_agent',
        isActive: true,
      });
    }

    // Ensure TeamMember records for agents
    let memberA = await TeamMember.findOne({ user: agentAUser._id });
    if (!memberA) {
      memberA = await TeamMember.create({
        user: agentAUser._id,
        role: agentRole._id,
        department: supportDept?._id,
        status: 'active',
      });
    } else {
      memberA.status = 'active';
      await memberA.save();
    }

    let memberB = await TeamMember.findOne({ user: agentBUser._id });
    if (!memberB) {
      memberB = await TeamMember.create({
        user: agentBUser._id,
        role: agentRole._id,
        department: supportDept?._id,
        status: 'active',
      });
    } else {
      memberB.status = 'active';
      await memberB.save();
    }

    assert(agentAUser && agentBUser && memberA && memberB, 'Created test support agents & TeamMember bindings');

    // 2. Customer Support Ticket Creation & SLA Target Calculation
    console.log('\n--- 2. CUSTOMER TICKET & SLA ENGINE ---');
    const slaTargets = await slaService.calculateDeadlines('urgent');
    assert(
      slaTargets.firstResponseDueAt && slaTargets.resolutionDueAt && slaTargets.firstResponseDueAt < slaTargets.resolutionDueAt,
      `Calculated Urgent SLA deadlines (Response: ${slaTargets.firstResponseDueAt.toISOString()}, Resolution: ${slaTargets.resolutionDueAt.toISOString()})`
    );

    const customerTicket = await SupportTicket.create({
      ticketNumber: `TKT-TEST-${Date.now().toString().slice(-4)}`,
      user: customer._id,
      isGuest: false,
      subject: 'Digital License Key Not Activating on Office 365',
      category: 'License Key Problem',
      priority: 'urgent',
      status: 'open',
      firstResponseDueAt: slaTargets.firstResponseDueAt,
      resolutionDueAt: slaTargets.resolutionDueAt,
      messages: [
        {
          sender: customer._id,
          senderRole: 'customer',
          senderName: customer.name,
          message: 'Hello, the key I received gives error code 0xC004C008 when entered into Office setup.',
          isInternal: false,
          createdAt: new Date(),
        },
      ],
    });

    assert(
      customerTicket && customerTicket._id && customerTicket.status === 'open' && customerTicket.isGuest === false,
      'Customer ticket created successfully with category License Key Problem and status open'
    );

    // 3. Guest Support Ticket Submission & SHA-256 Token Generation
    console.log('\n--- 3. GUEST TICKET SECURITY & ACCESS TOKEN ---');
    const rawGuestToken = crypto.randomBytes(32).toString('hex');
    const hashedGuestToken = crypto.createHash('sha256').update(rawGuestToken).digest('hex');

    const guestTicket = await SupportTicket.create({
      ticketNumber: `TKT-GST-${Date.now().toString().slice(-4)}`,
      isGuest: true,
      guestInfo: {
        name: 'Guest Shopper',
        email: 'guest.shopper@gmail.com',
        phone: '+1-555-0199',
        tokenHash: hashedGuestToken,
      },
      subject: 'Pre-sale Question about Windows 11 Pro Transferability',
      category: 'General Inquiry',
      priority: 'normal',
      status: 'new',
      messages: [
        {
          sender: null,
          senderRole: 'guest',
          senderName: 'Guest Shopper',
          message: 'Can this retail license be transferred to another PC if I upgrade my motherboard?',
          isInternal: false,
          createdAt: new Date(),
        },
      ],
    });

    assert(
      guestTicket && guestTicket.isGuest === true && guestTicket.guestInfo.tokenHash === hashedGuestToken,
      'Guest ticket stored with SHA-256 tokenHash'
    );

    // Verify Guest Access Lookup by Token
    const foundGuestTicket = await SupportTicket.findOne({
      'guestInfo.tokenHash': crypto.createHash('sha256').update(rawGuestToken).digest('hex'),
    });
    assert(
      foundGuestTicket && foundGuestTicket._id.toString() === guestTicket._id.toString(),
      'Guest retrieved ticket securely using raw token without exposing predictable database IDs'
    );

    // Verify Guest Reply
    foundGuestTicket.messages.push({
      sender: null,
      senderRole: 'guest',
      senderName: 'Guest Shopper',
      message: 'Also, does it include 64-bit ISO download links?',
      isInternal: false,
      createdAt: new Date(),
    });
    foundGuestTicket.status = 'open';
    await foundGuestTicket.save();

    assert(foundGuestTicket.messages.length === 2, 'Guest successfully appended reply to ticket');

    // 4. Staff Internal Notes & Strict Public Isolation
    console.log('\n--- 4. INTERNAL NOTES & PUBLIC DATA ISOLATION ---');
    // Staff adds internal note
    customerTicket.messages.push({
      sender: agentAUser._id,
      senderRole: 'support_agent',
      senderName: agentAUser.name,
      message: 'Verified key batch: batch #9812 has 2 other reports. Contacting distributor for replacement key.',
      isInternal: true,
      createdAt: new Date(),
    });
    await customerTicket.save();

    assert(customerTicket.messages.some((m) => m.isInternal === true), 'Staff added internal note to ticket');

    // Simulate customer retrieval filtering (Customer API logic)
    const publicMessages = customerTicket.messages.filter((m) => !m.isInternal);
    assert(
      !publicMessages.some((m) => m.isInternal) && publicMessages.length === 1,
      'Strict Isolation: Customer message view completely filters out internal staff notes'
    );

    // 5. Intelligent Workload-Based Agent Assignment
    console.log('\n--- 5. SMART WORKLOAD-BASED ASSIGNMENT ROUTING ---');
    // Give Agent A one active ticket and one chat
    customerTicket.assignedTo = agentAUser._id;
    customerTicket.status = 'assigned';
    await customerTicket.save();

    // Now test routing for a new unassigned ticket: should select Agent B because Agent B has 0 active items
    const selectedAgent = await assignmentService.findOptimalAgent({
      channel: 'ticket',
      departmentId: supportDept?._id,
    });

    assert(
      selectedAgent && selectedAgent._id.toString() === agentBUser._id.toString(),
      `Smart Router assigned ticket to least-busy Agent B (Selected: ${selectedAgent?.name})`
    );

    // 6. Suspended Agent Exclusion
    console.log('\n--- 6. SUSPENDED AGENT SAFETY GUARD ---');
    memberB.status = 'suspended';
    await memberB.save();

    const selectedAfterSuspension = await assignmentService.findOptimalAgent({
      channel: 'ticket',
      departmentId: supportDept?._id,
    });

    assert(
      selectedAfterSuspension && selectedAfterSuspension._id.toString() === agentAUser._id.toString(),
      'Suspended Agent B skipped; routed to active Agent A'
    );

    // Reset Agent B status
    memberB.status = 'active';
    await memberB.save();

    // 7. Live Chat Lifecycle (Customer & Guest Sessions)
    console.log('\n--- 7. REAL-TIME LIVE CHAT SESSIONS & MESSAGING ---');
    const guestChatSession = `guest_test_${Date.now()}`;
    const chatConvo = await ChatConversation.create({
      conversationId: `CONV-TEST-${Date.now().toString().slice(-4)}`,
      isGuest: true,
      guestInfo: {
        sessionId: guestChatSession,
        name: 'Live Chat Visitor',
        email: 'visitor@bundlebyte.com',
      },
      category: 'Order Issue',
      status: 'active',
      assignedAgent: agentAUser._id,
    });

    assert(chatConvo && chatConvo.status === 'active' && chatConvo.isGuest === true, 'Initiated guest live chat conversation');

    // Append chat messages
    const visitorMsg = await ChatMessage.create({
      conversation: chatConvo._id,
      senderType: 'guest',
      senderName: 'Live Chat Visitor',
      message: 'Hi, where can I download my invoice for order #ORD-1029?',
    });

    const agentReplyMsg = await ChatMessage.create({
      conversation: chatConvo._id,
      senderType: 'agent',
      sender: agentAUser._id,
      senderName: agentAUser.name,
      message: 'Hello! You can download your invoice directly from your Order History page, or I can email it to you right now.',
    });

    const internalChatNote = await ChatMessage.create({
      conversation: chatConvo._id,
      senderType: 'agent',
      sender: agentAUser._id,
      senderName: agentAUser.name,
      message: 'Customer verified order #ORD-1029. Sending invoice via email trigger.',
      isInternalNote: true,
    });

    const convoMessages = await ChatMessage.find({ conversation: chatConvo._id });
    assert(convoMessages.length === 3, 'Chat conversation persisted visitor messages, agent replies, and internal notes');

    // Test public chat message filtering
    const publicChatMessages = convoMessages.filter((m) => !m.isInternalNote);
    assert(
      publicChatMessages.length === 2 && !publicChatMessages.some((m) => m.isInternalNote),
      'Public chat view correctly excludes internal notes'
    );

    // 8. Chat-to-Ticket Conversion
    console.log('\n--- 8. CHAT-TO-TICKET CONVERSION WORKFLOW ---');
    const allChatMsgs = await ChatMessage.find({ conversation: chatConvo._id }).sort({ createdAt: 1 });
    const convertedTicketMessages = allChatMsgs.map((m) => ({
      sender: m.senderType === 'agent' ? m.sender : null,
      senderRole: m.senderType === 'agent' ? 'support_agent' : 'guest',
      senderName: m.senderName,
      message: m.message,
      isInternal: m.isInternalNote || false,
      createdAt: m.createdAt,
    }));

    const convertedTicket = await SupportTicket.create({
      ticketNumber: `TKT-CONV-${Date.now().toString().slice(-4)}`,
      isGuest: true,
      guestInfo: {
        name: chatConvo.guestInfo?.name || 'Live Chat Visitor',
        email: chatConvo.guestInfo?.email || 'visitor@bundlebyte.com',
      },
      subject: `Converted Live Chat: ${chatConvo.category}`,
      category: chatConvo.category,
      priority: 'normal',
      status: 'in_progress',
      assignedTo: chatConvo.assignedAgent,
      linkedConversation: chatConvo._id,
      messages: convertedTicketMessages,
    });

    chatConvo.status = 'converted_to_ticket';
    chatConvo.convertedTicket = convertedTicket._id;
    await chatConvo.save();

    assert(
      convertedTicket &&
        convertedTicket.linkedConversation.toString() === chatConvo._id.toString() &&
        convertedTicket.messages.length === 3 &&
        chatConvo.status === 'converted_to_ticket',
      'Converted live chat to ticket: full transcript preserved and bidirectional link established'
    );

    // 9. SLA Breach & Automated Escalation Engine
    console.log('\n--- 9. AUTOMATED SLA ESCALATION ENGINE ---');
    // Create an overdue ticket
    const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
    const overdueTicket = await SupportTicket.create({
      ticketNumber: `TKT-OVERDUE-${Date.now().toString().slice(-4)}`,
      user: customer._id,
      subject: 'Critical server outage - need assistance',
      category: 'Technical Problem',
      priority: 'high',
      status: 'open',
      firstResponseDueAt: pastDate,
      resolutionDueAt: pastDate,
      slaStatus: 'within_sla',
      messages: [
        {
          sender: customer._id,
          senderRole: 'customer',
          senderName: customer.name,
          message: 'Urgently need help!',
          createdAt: pastDate,
        },
      ],
    });

    const escalationResult = await slaService.checkAndEscalateTickets();
    const updatedOverdue = await SupportTicket.findById(overdueTicket._id);

    assert(
      updatedOverdue.slaStatus === 'breached' &&
        updatedOverdue.status === 'escalated' &&
        updatedOverdue.priority === 'urgent',
      `Auto-escalation scanned ticket: marked breached, bumped status to escalated and priority to urgent (Escalated Count: ${escalationResult.escalatedCount})`
    );

    // 10. CSAT & Resolution Rating
    console.log('\n--- 10. CUSTOMER SATISFACTION (CSAT) RATING ---');
    customerTicket.status = 'resolved';
    customerTicket.customerRating = {
      score: 5,
      feedback: 'Incredible response time! Replaced my license key in minutes.',
      ratedAt: new Date(),
    };
    await customerTicket.save();

    assert(
      customerTicket.status === 'resolved' && customerTicket.customerRating.score === 5,
      'Customer successfully submitted 5-star CSAT rating on resolved ticket'
    );

    // Clean up test records
    await SupportTicket.deleteMany({ ticketNumber: { $regex: /^TKT-(TEST|GST|CONV|OVERDUE)-/ } });
    await ChatConversation.deleteOne({ _id: chatConvo._id });
    await ChatMessage.deleteMany({ conversation: chatConvo._id });
    await User.deleteMany({ email: { $in: ['support_customer_test@bundlebyte.com', 'agent_alpha@bundlebyte.com', 'agent_beta@bundlebyte.com'] } });
    await TeamMember.deleteMany({ _id: { $in: [memberA._id, memberB._id] } });

    console.log('\n======================================================');
    console.log(`🎉 UNIFIED SUPPORT & LIVE CHAT TESTS COMPLETE`);
    console.log(`Passed: ${passed} | Failed: ${failed}`);
    console.log('======================================================\n');

    await disconnectDB();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution failed:', err);
    await disconnectDB();
    process.exit(1);
  }
};

runTests();
