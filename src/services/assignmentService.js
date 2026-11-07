import User from '../models/User.js';
import TeamMember from '../models/TeamMember.js';
import SupportTicket from '../models/SupportTicket.js';
import ChatConversation from '../models/ChatConversation.js';
import rbacService from './rbacService.js';

class AssignmentService {
  /**
   * Discovers eligible and active agents for support assignment.
   * Filters out suspended accounts, verifies RBAC permissions, and checks department affiliation.
   *
   * @param {Object} options
   * @param {string} options.requiredPermission - e.g. 'support_tickets.reply' or 'live_chat.reply'
   * @param {string} [options.departmentId] - Optional department scoping
   */
  async getEligibleAgents({ requiredPermission = 'support_tickets.reply', departmentId = null } = {}) {
    const memberQuery = { status: 'active' };
    if (departmentId) {
      memberQuery.department = departmentId;
    }

    const activeMembers = await TeamMember.find(memberQuery)
      .populate('user', 'name email avatar role isActive isSuspended isBanned')
      .populate('roles');

    const eligible = [];

    for (const member of activeMembers) {
      const u = member.user;
      if (!u || u.isBanned || u.isSuspended || !u.isActive) {
        continue;
      }

      const effectivePerms = await rbacService.getUserEffectivePermissions(u._id);
      if (rbacService.hasPermission(effectivePerms, requiredPermission)) {
        // Calculate current open workload count
        const [openTickets, activeChats] = await Promise.all([
          SupportTicket.countDocuments({
            assignedTo: u._id,
            status: { $in: ['new', 'open', 'assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_internal_team', 'escalated'] },
          }),
          ChatConversation.countDocuments({
            assignedAgent: u._id,
            status: { $in: ['active', 'assigned'] },
          }),
        ]);

        eligible.push({
          user: u,
          teamMember: member,
          openWorkloadCount: openTickets + activeChats,
          openTicketsCount: openTickets,
          activeChatsCount: activeChats,
        });
      }
    }

    return eligible;
  }

  /**
   * Intelligently selects the optimal agent using least-active workload routing.
   *
   * @param {Object} options
   * @param {string} options.channel - 'ticket' | 'chat'
   * @param {string} [options.departmentId]
   */
  async findOptimalAgent({ channel = 'ticket', departmentId = null } = {}) {
    const requiredPermission = channel === 'chat' ? 'live_chat.reply' : 'support_tickets.reply';
    let agents = await this.getEligibleAgents({ requiredPermission, departmentId });

    // Fallback: If no agent found in department, look across general support
    if (agents.length === 0 && departmentId) {
      agents = await this.getEligibleAgents({ requiredPermission, departmentId: null });
    }

    if (agents.length === 0) {
      return null;
    }

    // Sort by lowest current workload (least active workload routing)
    agents.sort((a, b) => a.openWorkloadCount - b.openWorkloadCount);

    return agents[0].user;
  }
}

export const assignmentService = new AssignmentService();
export default assignmentService;
