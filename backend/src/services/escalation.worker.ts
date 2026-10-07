import { Incident } from '../models/Incident.js';
import { EscalationPolicy } from '../models/EscalationPolicy.js';
import { IncidentEvent } from '../models/IncidentEvent.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Service } from '../models/Service.js';
import { realtimeService } from './realtime.service.js';
import { notificationService } from './notification.service.js';

/**
 * EscalationWorker — Runs every 15 seconds.
 *
 * For every incident with status "triggered":
 *  1. Loads the service's EscalationPolicy steps.
 *  2. Checks if the current step's timeoutMinutes has elapsed.
 *  3. If yes → advances to next step, assigns new user, sends an email,
 *     creates immutable IncidentEvent, broadcasts Socket.IO update.
 */
export class EscalationWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly checkIntervalMs = 15_000; // 15 seconds

  public start(): void {
    if (this.timer) return;
    console.log('[EscalationWorker] Background escalation service initialized (interval: 15s)');
    this.timer = setInterval(() => this.processPendingEscalations(), this.checkIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[EscalationWorker] Background escalation service stopped');
    }
  }

  public async processPendingEscalations(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Find all unacknowledged triggered incidents
      const openIncidents = await Incident.find({ status: 'triggered' });

      for (const incident of openIncidents) {
        try {
          await this.processIncident(incident);
        } catch (innerErr) {
          console.error(`[EscalationWorker] Error processing incident ${incident._id}:`, innerErr);
        }
      }
    } catch (error) {
      console.error('[EscalationWorker] Error in escalation cycle:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processIncident(incident: any): Promise<void> {
    // Fetch the escalation policy linked to this service
    const policy = await EscalationPolicy.findOne({
      organizationId: incident.organizationId,
      serviceId: incident.serviceId,
    });

    if (!policy || !policy.steps || policy.steps.length === 0) return;

    const currentStepIndex = incident.currentEscalationStep ?? 0;
    const currentStep = policy.steps[currentStepIndex] ?? policy.steps[0];
    const timeoutMs = (currentStep.timeoutMinutes || 5) * 60_000;

    // Reference time: when the incident was created or last escalated
    const referenceTime = incident.lastEscalatedAt ?? incident.createdAt;
    const elapsedMs = Date.now() - new Date(referenceTime).getTime();

    if (elapsedMs < timeoutMs) return; // Not yet timed out

    // ── Move to the next escalation step ─────────────────────────────────────
    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex >= policy.steps.length) return; // No more steps

    const nextStep = policy.steps[nextStepIndex];
    const nextUser = await User.findById(nextStep.notifyUserId);
    if (!nextUser) return;

    const service = await Service.findById(incident.serviceId);
    const serviceName = service?.name ?? 'Unknown Service';

    // ── Update incident in MongoDB ────────────────────────────────────────────
    incident.currentEscalationStep = nextStepIndex;
    incident.assignedUserId = nextStep.notifyUserId;
    incident.lastEscalatedAt = new Date();
    await incident.save();

    const stepLabel = `Step ${nextStep.order ?? nextStepIndex + 1}`;
    const channelLabel = 'EMAIL';
    const timeoutMinutes = currentStep.timeoutMinutes;

    // ── Immutable timeline event ──────────────────────────────────────────────
    const eventMessage =
      `Escalated to ${stepLabel}: assigned to ${nextUser.name} via ${channelLabel} ` +
      `after ${timeoutMinutes}m unacknowledged timeout.`;

    await IncidentEvent.create({
      organizationId: incident.organizationId,
      incidentId: incident._id,
      type: 'escalated',
      message: eventMessage,
      actorUserId: null,
      timestamp: new Date(),
    });

    // ── Send email via notification service ───────────────────────────────────
    const delivered = await notificationService.dispatchAlert({
      userEmail: nextUser.email,
      userName: nextUser.name,
      incidentNumber: incident.incidentNumber,
      incidentTitle: incident.title,
      incidentSeverity: incident.severity,
      escalationStep: nextStep.order ?? nextStepIndex + 1,
      serviceName,
    });

    const deliveryStatus = delivered ? 'sent' : 'failed';

    // ── Persist Notification record in MongoDB ────────────────────────────────
    const notification = await Notification.create({
      organizationId: incident.organizationId,
      incidentId: incident._id,
      userId: nextStep.notifyUserId,
      channel: 'email',
      status: deliveryStatus,
      subject: `[ESCALATION ${stepLabel}] ${incident.severity} Incident #${incident.incidentNumber}: ${incident.title}`,
      message: `Incident #${incident.incidentNumber} (${incident.severity}) escalated to ${nextUser.name} via ${channelLabel}. Unacknowledged for ${timeoutMinutes}m.`,
      sentAt: new Date(),
    });

    // ── Real-time Socket.IO broadcast to organization room ────────────────────
    const populatedIncident = await Incident.findById(incident._id)
      .populate('serviceId', 'name currentStatus')
      .populate('assignedUserId', 'name email role phone');

    realtimeService.emitIncidentUpdated(incident.organizationId.toString(), populatedIncident);
    realtimeService.emitNotificationSent(incident.organizationId.toString(), notification);

    console.log(
      `[EscalationWorker] Incident #${incident.incidentNumber} → ${stepLabel} → ${nextUser.name} ` +
      `[${channelLabel}] (delivery: ${deliveryStatus})`
    );
  }
}

export const escalationWorker = new EscalationWorker();
