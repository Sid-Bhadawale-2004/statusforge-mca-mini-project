import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { EscalationPolicy } from '../models/EscalationPolicy.js';
import { Service } from '../models/Service.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { notificationService } from '../services/notification.service.js';

export const policyRouter = Router();

policyRouter.use(authenticateToken);

const stepSchema = z.object({
  order: z.number().min(1),
  timeoutMinutes: z.number().min(1),
  notifyUserId: z.string().min(1),
  channel: z.literal('email'),
});

const createPolicySchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  name: z.string().min(2, 'Policy name must be at least 2 characters'),
  steps: z.array(stepSchema).min(1, 'At least one escalation step is required'),
  repeatCount: z.number().min(0).default(1),
});

const updatePolicySchema = z.object({
  name: z.string().min(2).optional(),
  steps: z.array(stepSchema).optional(),
  repeatCount: z.number().min(0).optional(),
});

// GET /api/v1/policies - List escalation policies with populated user steps
policyRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const policies = await EscalationPolicy.find({ organizationId: req.organizationId })
    .populate('serviceId', 'name currentStatus')
    .populate({
      path: 'steps.notifyUserId',
      select: 'name email role phone title',
    });

  const formatted = policies.map((policy) => {
    const svc: any = policy.serviceId;
    return {
      _id: policy._id,
      organizationId: policy.organizationId,
      serviceId: svc?._id || policy.serviceId,
      serviceName: svc?.name || 'Unknown Service',
      name: policy.name,
      repeatCount: policy.repeatCount,
      steps: policy.steps.map((step) => {
        const u: any = step.notifyUserId;
        return {
          order: step.order,
          timeoutMinutes: step.timeoutMinutes,
          notifyUserId: u?._id?.toString() || (step.notifyUserId as any)?.toString(),
          channel: 'email',
          user: u && u.name ? u : null,
        };
      }),
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
  });

  res.json({
    success: true,
    data: formatted,
  });
});

// POST /api/v1/policies - Create escalation policy
policyRouter.post('/', requireRole('admin', 'responder'), async (req: Request, res: Response): Promise<void> => {
  const validated = createPolicySchema.parse(req.body);

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

  const notifyUserIds = [...new Set(validated.steps.map((step) => step.notifyUserId))];
  const assignedUsers = await User.find({
    _id: { $in: notifyUserIds },
    organizationId: req.organizationId,
  }).select('name email');
  if (assignedUsers.length !== notifyUserIds.length) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_POLICY_ASSIGNEE',
        message: 'Every escalation assignee must belong to this organization.',
      },
    });
    return;
  }

  const policy = await EscalationPolicy.create({
    organizationId: req.organizationId,
    serviceId: service._id,
    name: validated.name.trim(),
    steps: validated.steps as any,
    repeatCount: validated.repeatCount,
  });

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CREATE_ESCALATION_POLICY',
    resourceType: 'EscalationPolicy',
    resourceId: policy._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: { name: policy.name, serviceName: service.name },
    timestamp: new Date(),
  });

  for (const user of assignedUsers) {
    const assignedSteps = validated.steps.filter(
      (step) => step.notifyUserId === user._id.toString()
    );
    void notificationService.sendEscalationPolicyAssignmentNotice({
      to: user.email,
      name: user.name,
      policyName: policy.name,
      serviceName: service.name,
      steps: assignedSteps.map(({ order, timeoutMinutes }) => ({ order, timeoutMinutes })),
    }).then((sent) => {
      if (!sent) console.error(`[Policy] Assignment email could not be sent to ${user.email}.`);
    }).catch((error) => {
      console.error(`[Policy] Assignment email failed for ${user.email}:`, error);
    });
  }

  const populated = await EscalationPolicy.findById(policy._id)
    .populate('serviceId', 'name currentStatus')
    .populate('steps.notifyUserId', 'name email role phone');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

// PUT /api/v1/policies/:id - Update policy steps
policyRouter.put('/:id', requireRole('admin', 'responder'), async (req: Request, res: Response): Promise<void> => {
  const validated = updatePolicySchema.parse(req.body);

  const policy = await EscalationPolicy.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!policy) {
    res.status(404).json({
      success: false,
      error: {
        code: 'POLICY_NOT_FOUND',
        message: 'Escalation policy not found in this organization.',
      },
    });
    return;
  }

  let newlyAssignedUsers: Array<{
    name: string;
    email: string;
    steps: Array<{ order: number; timeoutMinutes: number }>;
  }> = [];
  if (validated.steps !== undefined) {
    const validatedSteps = validated.steps;
    const notifyUserIds = [...new Set(validatedSteps.map((step) => step.notifyUserId))];
    const previousAssigneeIds = new Set(policy.steps.map((step) => step.notifyUserId.toString()));
    const assignedUsers = await User.find({
      _id: { $in: notifyUserIds },
      organizationId: req.organizationId,
    }).select('name email');
    if (assignedUsers.length !== notifyUserIds.length) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_POLICY_ASSIGNEE',
          message: 'Every escalation assignee must belong to this organization.',
        },
      });
      return;
    }
    newlyAssignedUsers = assignedUsers
      .filter((user) => !previousAssigneeIds.has(user._id.toString()))
      .map((user) => ({
        name: user.name,
        email: user.email,
        steps: validatedSteps
          .filter((step) => step.notifyUserId === user._id.toString())
          .map(({ order, timeoutMinutes }) => ({ order, timeoutMinutes })),
      }));
  }

  const service = await Service.findOne({
    _id: policy.serviceId,
    organizationId: req.organizationId,
  });
  if (!service) {
    res.status(404).json({
      success: false,
      error: {
        code: 'SERVICE_NOT_FOUND',
        message: 'The service associated with this policy was not found.',
      },
    });
    return;
  }

  if (validated.name !== undefined) policy.name = validated.name.trim();
  if (validated.steps !== undefined) (policy.steps as any) = validated.steps;
  if (validated.repeatCount !== undefined) policy.repeatCount = validated.repeatCount;

  await policy.save();

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'UPDATE_ESCALATION_POLICY',
    resourceType: 'EscalationPolicy',
    resourceId: policy._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: validated,
    timestamp: new Date(),
  });

  for (const user of newlyAssignedUsers) {
    void notificationService.sendEscalationPolicyAssignmentNotice({
      to: user.email,
      name: user.name,
      policyName: policy.name,
      serviceName: service.name,
      steps: user.steps,
    }).then((sent) => {
      if (!sent) console.error(`[Policy] Assignment email could not be sent to ${user.email}.`);
    }).catch((error) => {
      console.error(`[Policy] Assignment email failed for ${user.email}:`, error);
    });
  }

  const populated = await EscalationPolicy.findById(policy._id)
    .populate('serviceId', 'name currentStatus')
    .populate('steps.notifyUserId', 'name email role phone');

  res.json({
    success: true,
    data: populated,
  });
});
