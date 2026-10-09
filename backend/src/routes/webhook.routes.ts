import { Router, Request, Response } from 'express';
import { Service } from '../models/Service.js';
import { Incident } from '../models/Incident.js';
import { IncidentEvent } from '../models/IncidentEvent.js';
import { Notification } from '../models/Notification.js';
import { Organization } from '../models/Organization.js';
import { OnCallService } from '../services/oncall.service.js';
import { realtimeService } from '../services/realtime.service.js';
import { notificationService } from '../services/notification.service.js';

export const webhookRouter = Router();

// POST /api/v1/webhooks/services/:serviceId
webhookRouter.post('/services/:serviceId', async (req: Request, res: Response): Promise<void> => {
  const { serviceId } = req.params;
  const secretHeader = req.headers['x-webhook-secret'];

  if (!secretHeader || typeof secretHeader !== 'string') {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_WEBHOOK_SECRET',
        message: 'Header X-Webhook-Secret is required to authenticate alerts.',
      },
    });
    return;
  }

  const service = await Service.findById(serviceId);
  if (!service) {
    res.status(404).json({
      success: false,
      error: {
        code: 'SERVICE_NOT_FOUND',
        message: 'The target service does not exist.',
      },
    });
    return;
  }

  if (service.webhookSecret !== secretHeader) {
    res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_WEBHOOK_SECRET',
        message: 'The provided X-Webhook-Secret is invalid.',
      },
    });
    return;
  }

  const body = req.body || {};

  // Extract common fields across monitoring platforms (Prometheus, Datadog, Grafana, CloudWatch, Generic)
  const externalId =
    body.externalId ||
    body.id ||
    body.check_id ||
    body.alertId ||
    body.fingerprint ||
    (body.commonLabels && body.commonLabels.alertname) ||
    null;

  const title =
    body.title ||
    body.incidentTitle ||
    body.event_title ||
    body.ruleName ||
    (body.commonAnnotations && body.commonAnnotations.summary) ||
    `Automated Monitoring Alert for ${service.name}`;

  const description =
    body.description ||
    body.body ||
    body.message ||
    (body.commonAnnotations && body.commonAnnotations.description) ||
    'Alert triggered via monitoring webhook.';

  let severity: 'P1' | 'P2' | 'P3' | 'P4' = 'P2';
  const rawSev = (body.severity || body.priority || body.level || '').toUpperCase();
  if (rawSev.includes('1') || rawSev.includes('CRITICAL') || rawSev.includes('EMERGENCY')) {
    severity = 'P1';
  } else if (rawSev.includes('2') || rawSev.includes('HIGH') || rawSev.includes('ERROR')) {
    severity = 'P2';
  } else if (rawSev.includes('3') || rawSev.includes('MEDIUM') || rawSev.includes('WARN')) {
    severity = 'P3';
  } else if (rawSev.includes('4') || rawSev.includes('LOW') || rawSev.includes('INFO')) {
    severity = 'P4';
  }

  const isResolvedSignal =
    body.status === 'resolved' ||
    body.action === 'resolve' ||
    body.alert_type === 'recovery' ||
    (body.status === 'ok');

  // Deduplication check: Is there an existing open incident with this external ID on this service?
  if (externalId) {
    const openIncident = await Incident.findOne({
      organizationId: service.organizationId,
      serviceId: service._id,
      externalIncidentId: externalId,
      status: { $ne: 'resolved' },
    });

    if (openIncident) {
      if (isResolvedSignal) {
        // Auto-resolve open incident
        openIncident.status = 'resolved';
        openIncident.resolvedAt = new Date();
        openIncident.rootCauseSummary = `Auto-resolved by monitoring webhook (${externalId})`;
        await openIncident.save();

        await IncidentEvent.create({
          organizationId: service.organizationId,
          incidentId: openIncident._id,
          type: 'resolved',
          message: `Auto-resolved: monitoring alert clear signal received from webhook (${externalId}).`,
          actorUserId: null,
          timestamp: new Date(),
        });

        // Check if service can return to operational
        const otherOpen = await Incident.countDocuments({
          organizationId: service.organizationId,
          serviceId: service._id,
          status: { $ne: 'resolved' },
        });

        if (otherOpen === 0) {
          service.currentStatus = 'operational';
          await service.save();
        }

        const org = await Organization.findById(service.organizationId);
        realtimeService.emitIncidentResolved(service.organizationId.toString(), openIncident);
        realtimeService.emitServiceUpdated(service.organizationId.toString(), service, org?.slug);

        res.json({
          success: true,
          action: 'auto_resolved',
          incidentId: openIncident._id,
          incidentNumber: openIncident.incidentNumber,
          message: 'Existing incident automatically resolved by webhook.',
        });
        return;
      } else {
        // Deduplicated: record update on open incident
        await IncidentEvent.create({
          organizationId: service.organizationId,
          incidentId: openIncident._id,
          type: 'comment',
          message: `Duplicate alert ping received from monitoring source (${externalId}). Status remains ${openIncident.status}.`,
          actorUserId: null,
          timestamp: new Date(),
        });

        res.json({
          success: true,
          action: 'deduplicated',
          incidentId: openIncident._id,
          incidentNumber: openIncident.incidentNumber,
          message: 'Alert deduplicated against open incident.',
        });
        return;
      }
    }
  }

  // If resolved signal arrived without an active incident, acknowledge receipt
  if (isResolvedSignal) {
    res.json({
      success: true,
      action: 'ignored_resolved_state',
      message: 'Recovery signal received, no matching open incident found.',
    });
    return;
  }

  // Create new incident
  const lastIncident = await Incident.findOne({ organizationId: service.organizationId }).sort({ incidentNumber: -1 });
  const incidentNumber = lastIncident ? lastIncident.incidentNumber + 1 : 1001;

  // Resolve on-call responder for this service
  const onCallUser = await OnCallService.getActiveResponderForService(service.organizationId, service._id);

  // Update service status
  if (severity === 'P1') {
    service.currentStatus = 'outage';
  } else if (service.currentStatus === 'operational') {
    service.currentStatus = 'degraded';
  }
  await service.save();

  const incident = await Incident.create({
    organizationId: service.organizationId,
    serviceId: service._id,
    incidentNumber,
    title: title.slice(0, 150),
    description: description.slice(0, 1000),
    status: 'triggered',
    severity,
    currentEscalationStep: 0,
    assignedUserId: onCallUser ? onCallUser._id : null,
    source: body.source || 'monitoring_webhook',
    externalIncidentId: externalId,
    lastEscalatedAt: new Date(),
  });

  // Timeline Event
  await IncidentEvent.create({
    organizationId: service.organizationId,
    incidentId: incident._id,
    type: 'created',
    message: `Triggered by external webhook alert. Assigned to on-call responder: ${onCallUser ? onCallUser.name : 'Unassigned (No on-call)'}.`,
    actorUserId: null,
    metadata: { externalId, source: incident.source },
    timestamp: new Date(),
  });

  // Dispatch email after the incident is persisted; SMTP must not delay webhook acknowledgment.
  if (onCallUser) {
    void (async () => {
      try {
        const delivered = await notificationService.dispatchAlert({
          userEmail: onCallUser.email,
          userName: onCallUser.name,
          incidentNumber,
          incidentTitle: incident.title,
          incidentSeverity: severity,
          escalationStep: 1,
          serviceName: service.name,
        });
        const notificationRecord = await Notification.create({
          organizationId: service.organizationId,
          incidentId: incident._id,
          userId: onCallUser._id,
          channel: 'email',
          status: delivered ? 'sent' : 'failed',
          subject: `[WEBHOOK ALERT Step 1] ${severity} Incident #${incidentNumber}: ${incident.title}`,
          message: `Monitoring webhook triggered incident #${incidentNumber} on service '${service.name}'. You are the active on-call responder.`,
          sentAt: new Date(),
        });
        realtimeService.emitNotificationSent(service.organizationId.toString(), notificationRecord);
      } catch (error) {
        console.error(`[Webhook] Alert email processing failed for incident #${incidentNumber}:`, error);
      }
    })();
  }

  const populated = await Incident.findById(incident._id)
    .populate('serviceId', 'name currentStatus')
    .populate('assignedUserId', 'name email role phone');

  const org = await Organization.findById(service.organizationId);
  realtimeService.emitIncidentCreated(service.organizationId.toString(), populated);
  realtimeService.emitServiceUpdated(service.organizationId.toString(), service, org?.slug);

  res.status(201).json({
    success: true,
    action: 'created',
    incident: populated,
    assignedTo: onCallUser ? onCallUser.name : null,
  });
});
