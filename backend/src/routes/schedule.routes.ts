import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OnCallSchedule } from '../models/OnCallSchedule.js';
import { Service } from '../models/Service.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { OnCallService } from '../services/oncall.service.js';
import { notificationService } from '../services/notification.service.js';

export const scheduleRouter = Router();

scheduleRouter.use(authenticateToken);

const createScheduleSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  name: z.string().min(2, 'Schedule name must be at least 2 characters'),
  rotationMembers: z.array(z.string()).min(1, 'At least one rotation member is required'),
  rotationType: z.enum(['daily', 'weekly']).default('weekly'),
  startDate: z.string().optional(),
  timezone: z.string().optional().default('UTC'),
});

const updateScheduleSchema = z.object({
  name: z.string().min(2).optional(),
  rotationMembers: z.array(z.string()).min(1).optional(),
  rotationType: z.enum(['daily', 'weekly']).optional(),
  startDate: z.string().optional(),
  timezone: z.string().optional(),
});

// GET /api/v1/schedules - List schedules with real-time shift calculations
scheduleRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const schedules = await OnCallSchedule.find({ organizationId: req.organizationId })
    .populate('serviceId', 'name currentStatus')
    .populate('rotationMembers', 'name email role phone title');

  const enriched = await Promise.all(
    schedules.map(async (schedule) => {
      const calculation = await OnCallService.calculateOnCall(schedule);
      const svc: any = schedule.serviceId;

      return {
        _id: schedule._id,
        organizationId: schedule.organizationId,
        serviceId: svc?._id || schedule.serviceId,
        serviceName: svc?.name || 'Unknown Service',
        serviceStatus: svc?.currentStatus || 'operational',
        name: schedule.name,
        rotationMembers: schedule.rotationMembers,
        rotationType: schedule.rotationType,
        startDate: schedule.startDate,
        timezone: schedule.timezone,
        currentResponder: calculation.currentResponder,
        upcomingResponder: calculation.upcomingResponder,
        shiftStartsAt: calculation.currentShiftStart,
        shiftEndsAt: calculation.currentShiftEnd,
        shiftsPreview: calculation.forecast,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
      };
    })
  );

  res.json({
    success: true,
    data: enriched,
  });
});

// POST /api/v1/schedules - Create schedule
scheduleRouter.post('/', requireRole('admin', 'responder'), async (req: Request, res: Response): Promise<void> => {
  const validated = createScheduleSchema.parse(req.body);
  const memberIds = [...new Set(validated.rotationMembers)];

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

  const members = await User.find({
    _id: { $in: memberIds },
    organizationId: req.organizationId,
  }).select('name email');
  if (members.length !== memberIds.length) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ROTATION_MEMBER',
        message: 'Every rotation member must belong to this organization.',
      },
    });
    return;
  }

  const schedule = await OnCallSchedule.create({
    organizationId: req.organizationId,
    serviceId: service._id,
    name: validated.name.trim(),
    rotationMembers: members.map((member) => member._id),
    rotationType: validated.rotationType,
    startDate: validated.startDate ? new Date(validated.startDate) : new Date(),
    timezone: validated.timezone || 'UTC',
  });

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CREATE_SCHEDULE',
    resourceType: 'OnCallSchedule',
    resourceId: schedule._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: { name: schedule.name, serviceName: service.name },
    timestamp: new Date(),
  });

  for (const member of members) {
    void notificationService.sendOnCallAssignmentNotice({
      to: member.email,
      name: member.name,
      scheduleName: schedule.name,
      serviceName: service.name,
      rotationType: schedule.rotationType,
      timezone: schedule.timezone,
    }).then((sent) => {
      if (!sent) console.error(`[Schedule] Assignment email could not be sent to ${member.email}.`);
    }).catch((error) => {
      console.error(`[Schedule] Assignment email failed for ${member.email}:`, error);
    });
  }

  const populated = await OnCallSchedule.findById(schedule._id)
    .populate('serviceId', 'name currentStatus')
    .populate('rotationMembers', 'name email role phone title');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

// PUT /api/v1/schedules/:id - Update schedule
scheduleRouter.put('/:id', requireRole('admin', 'responder'), async (req: Request, res: Response): Promise<void> => {
  const validated = updateScheduleSchema.parse(req.body);

  const schedule = await OnCallSchedule.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!schedule) {
    res.status(404).json({
      success: false,
      error: {
        code: 'SCHEDULE_NOT_FOUND',
        message: 'Schedule not found in this organization.',
      },
    });
    return;
  }

  const service = await Service.findOne({
    _id: schedule.serviceId,
    organizationId: req.organizationId,
  });
  if (!service) {
    res.status(404).json({
      success: false,
      error: {
        code: 'SERVICE_NOT_FOUND',
        message: 'The service associated with this schedule was not found.',
      },
    });
    return;
  }

  let newlyAddedMembers: Array<{ name: string; email: string }> = [];
  if (validated.rotationMembers !== undefined) {
    const memberIds = [...new Set(validated.rotationMembers)];
    const previousMemberIds = new Set(schedule.rotationMembers.map((memberId) => memberId.toString()));
    const members = await User.find({
      _id: { $in: memberIds },
      organizationId: req.organizationId,
    }).select('name email');
    if (members.length !== memberIds.length) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROTATION_MEMBER',
          message: 'Every rotation member must belong to this organization.',
        },
      });
      return;
    }
    newlyAddedMembers = members
      .filter((member) => !previousMemberIds.has(member._id.toString()))
      .map((member) => ({ name: member.name, email: member.email }));
    schedule.rotationMembers = members.map((member) => member._id);
  }

  if (validated.name !== undefined) schedule.name = validated.name.trim();
  if (validated.rotationType !== undefined) schedule.rotationType = validated.rotationType;
  if (validated.startDate !== undefined) schedule.startDate = new Date(validated.startDate);
  if (validated.timezone !== undefined) schedule.timezone = validated.timezone;

  await schedule.save();

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'UPDATE_SCHEDULE',
    resourceType: 'OnCallSchedule',
    resourceId: schedule._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: validated,
    timestamp: new Date(),
  });

  for (const member of newlyAddedMembers) {
    void notificationService.sendOnCallAssignmentNotice({
      to: member.email,
      name: member.name,
      scheduleName: schedule.name,
      serviceName: service.name,
      rotationType: schedule.rotationType,
      timezone: schedule.timezone,
    }).then((sent) => {
      if (!sent) console.error(`[Schedule] Assignment email could not be sent to ${member.email}.`);
    }).catch((error) => {
      console.error(`[Schedule] Assignment email failed for ${member.email}:`, error);
    });
  }

  const populated = await OnCallSchedule.findById(schedule._id)
    .populate('serviceId', 'name currentStatus')
    .populate('rotationMembers', 'name email role phone title');

  res.json({
    success: true,
    data: populated,
  });
});
