import SupportSLA from '../models/SupportSLA.js';
import SupportTicket from '../models/SupportTicket.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import rbacService from './rbacService.js';
import { SENSITIVITY_LEVELS } from '../constants/permissionsRegistry.js';

class SLAService {
  /**
   * Initializes default SLA policies if not present
   */
  async seedDefaultSLAs() {
    const defaultSLAs = [
      {
        priority: 'urgent',
        name: 'Urgent SLA (P1)',
        firstResponseTargetMinutes: 15,
        resolutionTargetMinutes: 120, // 2 hours
        autoEscalate: true,
        isActive: true,
      },
      {
        priority: 'high',
        name: 'High Priority SLA (P2)',
        firstResponseTargetMinutes: 60, // 1 hour
        resolutionTargetMinutes: 360, // 6 hours
        autoEscalate: true,
        isActive: true,
      },
      {
        priority: 'normal',
        name: 'Normal SLA (P3)',
        firstResponseTargetMinutes: 240, // 4 hours
        resolutionTargetMinutes: 1440, // 24 hours
        autoEscalate: true,
        isActive: true,
      },
      {
        priority: 'low',
        name: 'Low Priority SLA (P4)',
        firstResponseTargetMinutes: 720, // 12 hours
        resolutionTargetMinutes: 2880, // 48 hours
        autoEscalate: false,
        isActive: true,
      },
    ];

    for (const sla of defaultSLAs) {
      await SupportSLA.findOneAndUpdate(
        { priority: sla.priority },
        { $setOnInsert: sla },
        { upsert: true, new: true }
      );
    }
  }

  /**
   * Computes SLA first response and resolution targets based on ticket priority
   * @param {string} priority - 'low' | 'normal' | 'high' | 'urgent'
   */
  async calculateDeadlines(priority = 'normal') {
    const sla = await SupportSLA.findOne({ priority, isActive: true });
    const firstMinutes = sla ? sla.firstResponseTargetMinutes : 240;
    const resMinutes = sla ? sla.resolutionTargetMinutes : 1440;

    const now = Date.now();
    return {
      firstResponseDueAt: new Date(now + firstMinutes * 60 * 1000),
      resolutionDueAt: new Date(now + resMinutes * 60 * 1000),
    };
  }

  /**
   * Background scan: Detects SLA breaches and escalates overdue tickets
   */
  async checkAndEscalateTickets() {
    let escalatedCount = 0;
    try {
      const now = new Date();

      // Find tickets breaching SLA that are not resolved/closed and not yet escalated
      const overdueTickets = await SupportTicket.find({
        status: { $in: ['open', 'assigned', 'in_progress', 'waiting_for_internal_team'] },
        isEscalated: false,
        $or: [
          { firstResponseAt: null, firstResponseDueAt: { $lt: now } },
          { resolutionDueAt: { $lt: now } },
        ],
      });

      for (const ticket of overdueTickets) {
        const isFirstResponseBreached = !ticket.firstResponseAt && ticket.firstResponseDueAt && ticket.firstResponseDueAt < now;
        const reason = isFirstResponseBreached ? 'First response SLA target breached' : 'Resolution SLA target breached';

        ticket.isEscalated = true;
        ticket.escalatedAt = now;
        ticket.escalatedReason = reason;
        ticket.status = 'escalated';
        ticket.slaStatus = 'breached';
        if (ticket.priority !== 'urgent') {
          ticket.priority = 'urgent';
        }
        ticket.activityLog.push({
          action: 'SLA_BREACH_AUTO_ESCALATION',
          actorName: 'SLA Background Monitor',
          details: { reason, firstResponseDueAt: ticket.firstResponseDueAt, resolutionDueAt: ticket.resolutionDueAt },
          timestamp: now,
        });

        await ticket.save();
        escalatedCount++;

        // Notify support managers and admins
        try {
          const managers = await User.find({ role: { $in: ['super_admin', 'admin', 'support_manager', 'manager'] } });
          for (const mgr of managers) {
            await Notification.create({
              user: mgr._id,
              title: `⚠️ SLA Escalation: Ticket #${ticket.ticketNumber}`,
              message: `Ticket "${ticket.subject}" breached SLA deadline (${reason}). Elevated to manager queue.`,
              type: 'system',
              link: `/admin/support`,
            });
          }
        } catch (notifErr) {
          console.error('Failed to notify managers of SLA escalation:', notifErr.message);
        }

        await rbacService.recordAuditLog({
          actor: null,
          actorEmail: 'system:sla_monitor',
          actorRole: 'system',
          action: 'TICKET_SLA_ESCALATED',
          entity: 'SupportTicket',
          entityId: ticket._id.toString(),
          details: { ticketNumber: ticket.ticketNumber, reason },
          severity: SENSITIVITY_LEVELS.HIGH,
        });
      }
      return { escalatedCount };
    } catch (err) {
      console.error('Error in SLA escalation scanner:', err.message);
      return { escalatedCount: 0, error: err.message };
    }
  }
}

export const slaService = new SLAService();
export default slaService;
