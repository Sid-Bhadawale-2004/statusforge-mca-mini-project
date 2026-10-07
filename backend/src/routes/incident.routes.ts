import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Incident } from '../models/Incident.js';
import { Service } from '../models/Service.js';
import { User } from '../models/User.js';
import { IncidentEvent } from '../models/IncidentEvent.js';
import { Notification } from '../models/Notification.js';
import { EscalationPolicy } from '../models/EscalationPolicy.js';
import { AuditLog } from '../models/AuditLog.js';
import { Organization } from '../models/Organization.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { OnCallService } from '../services/oncall.service.js';
import { realtimeService } from '../services/realtime.service.js';
import { notificationService } from '../services/notification.service.js';

export const incidentRouter = Router();

incidentRouter.use(authenticateToken);

const createIncidentSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional().default(''),
  severity: z.enum(['P1', 'P2', 'P3', 'P4']).default('P2'),
  source: z.string().optional().default('manual'),
});

const resolveIncidentSchema = z.object({
  rootCauseSummary: z.string().optional(),
});

const addCommentSchema = z.object({
  message: z.string().min(1, 'Comment message is required'),
});

// GET /api/v1/incidents - List incidents with filters
incidentRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const { status, severity, serviceId } = req.query;
  const filter: any = { organizationId: req.organizationId };

  if (status && typeof status === 'string' && status !== 'all') {
    filter.status = status;
  }
  if (severity && typeof severity === 'string' && severity !== 'all') {
    filter.severity = severity;
  }
  if (serviceId && typeof serviceId === 'string' && serviceId !== 'all') {
    filter.serviceId = serviceId;
  }

  const incidents = await Incident.find(filter)
    .populate('serviceId', 'name currentStatus')
    .populate('assignedUserId', 'name email role phone title')
    .populate('acknowledgedBy', 'name email')
    .populate('resolvedBy', 'name email')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: incidents,
  });
});

// POST /api/v1/incidents - Create a new incident
incidentRouter.post('/', requireRole('admin', 'responder'), async (req: Request, res: Response): Promise<void> => {
  const validated = createIncidentSchema.parse(req.body);

  const service = await Service.findOne({ _id: validated.serviceId, organizationId: req.organizationId });
  if (!service) {
    res.status(404).json({
      success: false,
      error: {
        code: 'SERVICE_NOT_FOUND',
        message: 'Service not found in this organization.',
      },
    });
    return;
  }

  // Calculate next incident number for organization
  const lastIncident = await Incident.findOne({ organizationId: req.organizationId }).sort({ incidentNumber: -1 });
  const incidentNumber = lastIncident ? lastIncident.incidentNumber + 1 : 1001;

  // Resolve on-call responder for this service
  const onCallUser = await OnCallService.getActiveResponderForService(req.organizationId!, service._id);
  const assignedUserId = onCallUser ? onCallUser._id : req.user!._id;

  // Update service status based on severity
  if (validated.severity === 'P1') {
    service.currentStatus = 'outage';
    await service.save();
  } else if (validated.severity === 'P2' && service.currentStatus === 'operational') {
    service.currentStatus = 'degraded';
    await service.save();
  }

  const incident = await Incident.create({
    organizationId: req.organizationId,
    serviceId: service._id,
    incidentNumber,
    title: validated.title.trim(),
    description: validated.description.trim(),
    severity: validated.severity,
    status: 'triggered',
    currentEscalationStep: 0,
    assignedUserId,
    source: validated.source,
    lastEscalatedAt: new Date(),
  });

  // Create initial incident timeline event
  await IncidentEvent.create({
    organizationId: req.organizationId,
    incidentId: incident._id,
    type: 'created',
    message: `Incident #${incidentNumber} created with severity ${incident.severity} by ${req.user!.name}. Assigned to ${onCallUser ? onCallUser.name : req.user!.name}.`,
    actorUserId: req.user!._id,
    timestamp: new Date(),
  });

  // ── Send email to the assigned on-call user (Step 1 alert) ───────────────
  const assignedUser = onCallUser ?? req.user!;
  const delivered = await notificationService.dispatchAlert({
    userEmail: assignedUser.email,
    userName: assignedUser.name,
    incidentNumber,
    incidentTitle: incident.title,
    incidentSeverity: incident.severity,
    escalationStep: 1,
    serviceName: service.name,
  });

  const notif = await Notification.create({
    organizationId: req.organizationId,
    incidentId: incident._id,
    userId: assignedUserId,
    channel: 'email',
    status: delivered ? 'sent' : 'failed',
    subject: `[ALERT Step 1] ${incident.severity} Incident #${incidentNumber}: ${incident.title}`,
    message: `A new incident has been triggered on ${service.name}. Title: ${incident.title}. Description: ${incident.description}`,
    sentAt: new Date(),
  });

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CREATE_INCIDENT',
    resourceType: 'Incident',
    resourceId: incident._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: { incidentNumber, severity: incident.severity, title: incident.title },
    timestamp: new Date(),
  });

  const populated = await Incident.findById(incident._id)
    .populate('serviceId', 'name currentStatus')
    .populate('assignedUserId', 'name email role phone');

  const org = await Organization.findById(req.organizationId);
  realtimeService.emitIncidentCreated(req.organizationId!.toString(), populated);
  realtimeService.emitNotificationSent(req.organizationId!.toString(), notif);
  realtimeService.emitServiceUpdated(req.organizationId!.toString(), service, org?.slug);

  res.status(201).json({
    success: true,
    data: populated,
  });
});

// GET /api/v1/incidents/:id - Get incident war-room details with events & notifications
incidentRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const incident = await Incident.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('serviceId', 'name currentStatus webhookSecret uptimePercentage')
    .populate('assignedUserId', 'name email role phone title')
    .populate('acknowledgedBy', 'name email role')
    .populate('resolvedBy', 'name email role');

  if (!incident) {
    res.status(404).json({
      success: false,
      error: {
        code: 'INCIDENT_NOT_FOUND',
        message: 'Incident not found in this organization.',
      },
    });
    return;
  }

  const events = await IncidentEvent.find({ incidentId: incident._id })
    .populate('actorUserId', 'name email role')
    .sort({ timestamp: 1 });

  const notifications = await Notification.find({ incidentId: incident._id })
    .populate('userId', 'name email phone')
    .sort({ sentAt: -1 });

  const policy = await EscalationPolicy.findOne({
    organizationId: req.organizationId,
    serviceId: (incident.serviceId as any)._id || incident.serviceId,
  }).populate('steps.notifyUserId', 'name email role phone');

  res.json({
    success: true,
    data: {
      ...incident.toObject(),
      events,
      notifications,
      escalationPolicy: policy,
    },
  });
});

// POST /api/v1/incidents/:id/acknowledge - Halts escalation immediately
incidentRouter.post('/:id/acknowledge', requireRole('admin', 'responder'), async (req: Request, res: Response): Promise<void> => {
  const incident = await Incident.findOne({ _id: req.params.id, organizationId: req.organizationId });

  if (!incident) {
    res.status(404).json({
      success: false,
      error: {
        code: 'INCIDENT_NOT_FOUND',
        message: 'Incident not found in this organization.',
      },
    });
    return;
  }

  if (incident.status === 'resolved') {
    res.status(400).json({
      success: false,
      error: {
        code: 'ALREADY_RESOLVED',
        message: 'Cannot acknowledge a resolved incident.',
      },
    });
    return;
  }

  incident.status = 'acknowledged';
  incident.acknowledgedBy = req.user!._id;
  incident.acknowledgedAt = new Date();
  await incident.save();

  // Create timeline event
  await IncidentEvent.create({
    organizationId: req.organizationId,
    incidentId: incident._id,
    type: 'acknowledged',
    message: `Incident acknowledged by ${req.user!.name}. Escalation timer halted.`,
    actorUserId: req.user!._id,
    timestamp: new Date(),
  });

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'ACKNOWLEDGE_INCIDENT',
    resourceType: 'Incident',
    resourceId: incident._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: { incidentNumber: incident.incidentNumber },
    timestamp: new Date(),
  });

  const populated = await Incident.findById(incident._id)
    .populate('serviceId', 'name currentStatus')
    .populate('assignedUserId', 'name email role phone')
    .populate('acknowledgedBy', 'name email');

  realtimeService.emitIncidentUpdated(req.organizationId!.toString(), populated);

  res.json({
    success: true,
    data: populated,
  });
});

// POST /api/v1/incidents/:id/resolve - Resolves incident and restores service status
incidentRouter.post('/:id/resolve', requireRole('admin', 'responder'), async (req: Request, res: Response): Promise<void> => {
  const validated = resolveIncidentSchema.parse(req.body);
  const incident = await Incident.findOne({ _id: req.params.id, organizationId: req.organizationId });

  if (!incident) {
    res.status(404).json({
      success: false,
      error: {
        code: 'INCIDENT_NOT_FOUND',
        message: 'Incident not found in this organization.',
      },
    });
    return;
  }

  incident.status = 'resolved';
  incident.resolvedBy = req.user!._id;
  incident.resolvedAt = new Date();
  if (validated.rootCauseSummary) {
    incident.rootCauseSummary = validated.rootCauseSummary.trim();
  }
  await incident.save();

  // Check if other open incidents exist on this service
  const otherOpen = await Incident.countDocuments({
    organizationId: req.organizationId,
    serviceId: incident.serviceId,
    status: { $ne: 'resolved' },
    _id: { $ne: incident._id },
  });

  let serviceRestored = false;
  if (otherOpen === 0) {
    const service = await Service.findById(incident.serviceId);
    if (service) {
      service.currentStatus = 'operational';
      await service.save();
      serviceRestored = true;
      const org = await Organization.findById(req.organizationId);
      realtimeService.emitServiceUpdated(req.organizationId!.toString(), service, org?.slug);
    }
  }

  const message = validated.rootCauseSummary
    ? `Incident resolved by ${req.user!.name}. Root Cause: ${validated.rootCauseSummary}`
    : `Incident resolved by ${req.user!.name}.`;

  await IncidentEvent.create({
    organizationId: req.organizationId,
    incidentId: incident._id,
    type: 'resolved',
    message,
    actorUserId: req.user!._id,
    timestamp: new Date(),
  });

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'RESOLVE_INCIDENT',
    resourceType: 'Incident',
    resourceId: incident._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: {
      incidentNumber: incident.incidentNumber,
      rootCauseSummary: validated.rootCauseSummary,
      serviceRestored,
    },
    timestamp: new Date(),
  });

  const populated = await Incident.findById(incident._id)
    .populate('serviceId', 'name currentStatus')
    .populate('assignedUserId', 'name email role phone')
    .populate('resolvedBy', 'name email');

  realtimeService.emitIncidentResolved(req.organizationId!.toString(), populated);

  res.json({
    success: true,
    data: populated,
  });
});

// POST /api/v1/incidents/:id/escalate - Manual immediate escalation to next step
incidentRouter.post('/:id/escalate', requireRole('admin', 'responder'), async (req: Request, res: Response): Promise<void> => {
  const incident = await Incident.findOne({ _id: req.params.id, organizationId: req.organizationId });

  if (!incident) {
    res.status(404).json({
      success: false,
      error: {
        code: 'INCIDENT_NOT_FOUND',
        message: 'Incident not found in this organization.',
      },
    });
    return;
  }

  const policy = await EscalationPolicy.findOne({
    organizationId: req.organizationId,
    serviceId: incident.serviceId,
  });

  if (!policy || !policy.steps || policy.steps.length === 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'NO_POLICY_STEPS',
        message: 'No escalation steps defined for this service.',
      },
    });
    return;
  }

  const nextStepIndex = Math.min((incident.currentEscalationStep || 0) + 1, policy.steps.length - 1);
  const nextStep = policy.steps[nextStepIndex];
  const nextUser = await User.findById(nextStep.notifyUserId);

  incident.currentEscalationStep = nextStepIndex;
  incident.assignedUserId = nextStep.notifyUserId;
  incident.lastEscalatedAt = new Date();
  await incident.save();

  await IncidentEvent.create({
    organizationId: req.organizationId,
    incidentId: incident._id,
    type: 'escalated',
    message: `Manually escalated to Step ${nextStep.order} (${nextUser ? nextUser.name : 'Responder'}) via EMAIL by ${req.user!.name}.`,
    actorUserId: req.user!._id,
    timestamp: new Date(),
  });

  const delivered = nextUser
    ? await notificationService.dispatchAlert({
        userEmail: nextUser.email,
        userName: nextUser.name,
        incidentNumber: incident.incidentNumber,
        incidentTitle: incident.title,
        incidentSeverity: incident.severity,
        escalationStep: nextStep.order,
        serviceName: (await Service.findById(incident.serviceId))?.name ?? 'Unknown Service',
      })
    : false;

  const notif = await Notification.create({
    organizationId: req.organizationId,
    incidentId: incident._id,
    userId: nextStep.notifyUserId,
    channel: 'email',
    status: delivered ? 'sent' : 'failed',
    subject: `[MANUAL ESCALATION Step ${nextStep.order}] ${incident.severity} Incident #${incident.incidentNumber}`,
    message: `Incident #${incident.incidentNumber} was manually escalated to you by ${req.user!.name}.`,
    sentAt: new Date(),
  });

  const populated = await Incident.findById(incident._id)
    .populate('serviceId', 'name currentStatus')
    .populate('assignedUserId', 'name email role phone');

  realtimeService.emitIncidentUpdated(req.organizationId!.toString(), populated);
  realtimeService.emitNotificationSent(req.organizationId!.toString(), notif);

  res.json({
    success: true,
    data: populated,
  });
});

// POST /api/v1/incidents/:id/comments - Add internal war-room update
incidentRouter.post('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  const validated = addCommentSchema.parse(req.body);
  const incident = await Incident.findOne({ _id: req.params.id, organizationId: req.organizationId });

  if (!incident) {
    res.status(404).json({
      success: false,
      error: {
        code: 'INCIDENT_NOT_FOUND',
        message: 'Incident not found in this organization.',
      },
    });
    return;
  }

  const event = await IncidentEvent.create({
    organizationId: req.organizationId,
    incidentId: incident._id,
    type: 'comment',
    message: validated.message.trim(),
    actorUserId: req.user!._id,
    timestamp: new Date(),
  });

  const populatedEvent = await IncidentEvent.findById(event._id).populate('actorUserId', 'name email role');

  realtimeService.emitIncidentUpdated(req.organizationId!.toString(), {
    _id: incident._id,
    newEvent: populatedEvent,
  });

  res.status(201).json({
    success: true,
    data: populatedEvent,
  });
});
