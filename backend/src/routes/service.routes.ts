import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { Service } from '../models/Service.js';
import { OnCallSchedule } from '../models/OnCallSchedule.js';
import { EscalationPolicy } from '../models/EscalationPolicy.js';
import { Incident } from '../models/Incident.js';
import { Organization } from '../models/Organization.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { OnCallService } from '../services/oncall.service.js';
import { realtimeService } from '../services/realtime.service.js';

export const serviceRouter = Router();

serviceRouter.use(authenticateToken);

const createServiceSchema = z.object({
  name: z.string().min(2, 'Service name must be at least 2 characters'),
  description: z.string().optional().default(''),
  currentStatus: z.enum(['operational', 'degraded', 'outage']).optional().default('operational'),
  uptimePercentage: z.number().min(0).max(100).optional().default(100.0),
});

const updateServiceSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  currentStatus: z.enum(['operational', 'degraded', 'outage']).optional(),
  uptimePercentage: z.number().min(0).max(100).optional(),
});

// GET /api/v1/services - List all services in org with on-call & health data
serviceRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const services = await Service.find({ organizationId: req.organizationId }).sort({ name: 1 });

  // Enrich with active responder and active incident counts
  const enriched = await Promise.all(
    services.map(async (svc) => {
      const activeIncidentsCount = await Incident.countDocuments({
        organizationId: req.organizationId,
        serviceId: svc._id,
        status: { $ne: 'resolved' },
      });

      const schedule = await OnCallSchedule.findOne({
        organizationId: req.organizationId,
        serviceId: svc._id,
      }).populate('rotationMembers');

      let onCallResponder = null;
      let upcomingResponder = null;
      let scheduleName = '';

      if (schedule) {
        scheduleName = schedule.name;
        const onCallData = await OnCallService.calculateOnCall(schedule);
        onCallResponder = onCallData.currentResponder;
        upcomingResponder = onCallData.upcomingResponder;
      }

      const policy = await EscalationPolicy.findOne({
        organizationId: req.organizationId,
        serviceId: svc._id,
      });

      return {
        ...svc.toObject(),
        activeIncidentsCount,
        onCallResponder,
        upcomingResponder,
        scheduleName,
        escalationPolicyName: policy ? policy.name : undefined,
        escalationStepsCount: policy ? policy.steps.length : 0,
      };
    })
  );

  res.json({
    success: true,
    data: enriched,
  });
});

// POST /api/v1/services - Create a new service
serviceRouter.post('/', requireRole('admin', 'responder'), async (req: Request, res: Response): Promise<void> => {
  const validated = createServiceSchema.parse(req.body);

  const existing = await Service.findOne({
    organizationId: req.organizationId,
    name: validated.name.trim(),
  });

  if (existing) {
    res.status(409).json({
      success: false,
      error: {
        code: 'SERVICE_EXISTS',
        message: `A service named '${validated.name}' already exists in your organization.`,
      },
    });
    return;
  }

  const webhookSecret = crypto.randomBytes(16).toString('hex');

  const service = await Service.create({
    organizationId: req.organizationId,
    name: validated.name.trim(),
    description: validated.description.trim(),
    currentStatus: validated.currentStatus,
    uptimePercentage: validated.uptimePercentage,
    webhookSecret,
  });

  // Seed default schedule with the creator
  await OnCallSchedule.create({
    organizationId: req.organizationId,
    serviceId: service._id,
    name: `${service.name} On-Call Schedule`,
    rotationMembers: [req.user!._id],
    rotationType: 'weekly',
    startDate: new Date(),
    timezone: 'UTC',
  });

  // Seed default escalation policy
  await EscalationPolicy.create({
    organizationId: req.organizationId,
    serviceId: service._id,
    name: `${service.name} Escalation Policy`,
    steps: [
      {
        order: 1,
        timeoutMinutes: 5,
        notifyUserId: req.user!._id,
        channel: 'email',
      },
      {
        order: 2,
        timeoutMinutes: 15,
        notifyUserId: req.user!._id,
        channel: 'email',
      },
    ],
    repeatCount: 1,
  });

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CREATE_SERVICE',
    resourceType: 'Service',
    resourceId: service._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: { name: service.name, currentStatus: service.currentStatus },
    timestamp: new Date(),
  });

  const org = await Organization.findById(req.organizationId);
  realtimeService.emitServiceUpdated(req.organizationId!.toString(), service, org?.slug);

  res.status(201).json({
    success: true,
    data: service,
  });
});

// PUT /api/v1/services/:id - Update service status, name, or description
serviceRouter.put('/:id', requireRole('admin', 'responder'), async (req: Request, res: Response): Promise<void> => {
  const validated = updateServiceSchema.parse(req.body);
  const service = await Service.findOne({ _id: req.params.id, organizationId: req.organizationId });

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

  const prevStatus = service.currentStatus;

  if (validated.name !== undefined) service.name = validated.name.trim();
  if (validated.description !== undefined) service.description = validated.description.trim();
  if (validated.currentStatus !== undefined) service.currentStatus = validated.currentStatus;
  if (validated.uptimePercentage !== undefined) service.uptimePercentage = validated.uptimePercentage;

  await service.save();

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'UPDATE_SERVICE',
    resourceType: 'Service',
    resourceId: service._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: {
      name: service.name,
      previousStatus: prevStatus,
      newStatus: service.currentStatus,
    },
    timestamp: new Date(),
  });

  const org = await Organization.findById(req.organizationId);
  realtimeService.emitServiceUpdated(req.organizationId!.toString(), service, org?.slug);

  res.json({
    success: true,
    data: service,
  });
});

// POST /api/v1/services/:id/rotate-webhook - Rotate service webhook secret
serviceRouter.post('/:id/rotate-webhook', requireRole('admin', 'responder'), async (req: Request, res: Response): Promise<void> => {
  const service = await Service.findOne({ _id: req.params.id, organizationId: req.organizationId });

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

  service.webhookSecret = crypto.randomBytes(16).toString('hex');
  await service.save();

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'ROTATE_WEBHOOK_SECRET',
    resourceType: 'Service',
    resourceId: service._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: { serviceName: service.name },
    timestamp: new Date(),
  });

  res.json({
    success: true,
    data: {
      serviceId: service._id,
      webhookSecret: service.webhookSecret,
    },
  });
});

// DELETE /api/v1/services/:id - Remove service
serviceRouter.delete('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const service = await Service.findOne({ _id: req.params.id, organizationId: req.organizationId });

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

  await Service.deleteOne({ _id: service._id, organizationId: req.organizationId });
  await OnCallSchedule.deleteMany({ serviceId: service._id, organizationId: req.organizationId });
  await EscalationPolicy.deleteMany({ serviceId: service._id, organizationId: req.organizationId });

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'DELETE_SERVICE',
    resourceType: 'Service',
    resourceId: service._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: { name: service.name },
    timestamp: new Date(),
  });

  res.json({
    success: true,
    message: 'Service and associated policies removed.',
  });
});
