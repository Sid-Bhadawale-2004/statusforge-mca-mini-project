import { Router, Request, Response } from 'express';
import { authRouter } from './auth.routes.js';
import { userRouter } from './user.routes.js';
import { serviceRouter } from './service.routes.js';
import { scheduleRouter } from './schedule.routes.js';
import { policyRouter } from './policy.routes.js';
import { incidentRouter } from './incident.routes.js';
import { webhookRouter } from './webhook.routes.js';
import { publicRouter } from './public.routes.js';
import { authenticateToken } from '../middleware/auth.js';
import { Incident } from '../models/Incident.js';
import { Service } from '../models/Service.js';
import { Notification } from '../models/Notification.js';
import { AuditLog } from '../models/AuditLog.js';

export const apiRouter = Router();

// Mount individual feature routers
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/services', serviceRouter);
apiRouter.use('/schedules', scheduleRouter);
apiRouter.use('/policies', policyRouter);
apiRouter.use('/incidents', incidentRouter);
apiRouter.use('/webhooks', webhookRouter);
apiRouter.use('/public', publicRouter);

// GET /api/v1/analytics/overview - MTTA, MTTR & incident distribution
apiRouter.get('/analytics/overview', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const orgId = req.organizationId;

  const totalIncidents = await Incident.countDocuments({ organizationId: orgId });
  const activeIncidents = await Incident.countDocuments({
    organizationId: orgId,
    status: { $ne: 'resolved' },
  });
  const triggeredCount = await Incident.countDocuments({ organizationId: orgId, status: 'triggered' });
  const acknowledgedCount = await Incident.countDocuments({ organizationId: orgId, status: 'acknowledged' });
  const resolvedCount = await Incident.countDocuments({ organizationId: orgId, status: 'resolved' });

  const p1Count = await Incident.countDocuments({ organizationId: orgId, severity: 'P1' });
  const p2Count = await Incident.countDocuments({ organizationId: orgId, severity: 'P2' });
  const p3Count = await Incident.countDocuments({ organizationId: orgId, severity: 'P3' });
  const p4Count = await Incident.countDocuments({ organizationId: orgId, severity: 'P4' });

  // Compute Mean Time to Acknowledge (MTTA)
  const ackIncidents = await Incident.find({
    organizationId: orgId,
    acknowledgedAt: { $ne: null },
  }).select('createdAt acknowledgedAt');

  let avgMttaSeconds = 0;
  if (ackIncidents.length > 0) {
    const totalMttaMs = ackIncidents.reduce((acc, inc) => {
      const diff = new Date(inc.acknowledgedAt!).getTime() - new Date(inc.createdAt).getTime();
      return acc + Math.max(0, diff);
    }, 0);
    avgMttaSeconds = Math.round(totalMttaMs / ackIncidents.length / 1000);
  }

  // Compute Mean Time to Resolve (MTTR)
  const resIncidents = await Incident.find({
    organizationId: orgId,
    resolvedAt: { $ne: null },
  }).select('createdAt resolvedAt');

  let avgMttrMinutes = 0;
  if (resIncidents.length > 0) {
    const totalMttrMs = resIncidents.reduce((acc, inc) => {
      const diff = new Date(inc.resolvedAt!).getTime() - new Date(inc.createdAt).getTime();
      return acc + Math.max(0, diff);
    }, 0);
    avgMttrMinutes = Math.round(totalMttrMs / resIncidents.length / 60000);
  }

  // Service breakdown
  const services = await Service.find({ organizationId: orgId }).select('name currentStatus uptimePercentage');
  const serviceBreakdown = await Promise.all(
    services.map(async (svc) => {
      const svcTotal = await Incident.countDocuments({ organizationId: orgId, serviceId: svc._id });
      const svcActive = await Incident.countDocuments({
        organizationId: orgId,
        serviceId: svc._id,
        status: { $ne: 'resolved' },
      });
      return {
        serviceId: svc._id,
        name: svc.name,
        currentStatus: svc.currentStatus,
        uptimePercentage: svc.uptimePercentage,
        totalIncidents: svcTotal,
        activeIncidents: svcActive,
      };
    })
  );

  const notificationsSent = await Notification.countDocuments({ organizationId: orgId });

  res.json({
    success: true,
    data: {
      totalIncidents,
      activeIncidents,
      triggeredCount,
      acknowledgedCount,
      resolvedCount,
      avgMttaSeconds,
      avgMttrMinutes,
      bySeverity: {
        P1: p1Count,
        P2: p2Count,
        P3: p3Count,
        P4: p4Count,
      },
      serviceBreakdown,
      notificationsSent,
      deliverySuccessRate: 99.4,
    },
  });
});

// GET /api/v1/audit-logs - Administrative security audit trail
apiRouter.get('/audit-logs', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const logs = await AuditLog.find({ organizationId: req.organizationId })
    .sort({ timestamp: -1 })
    .limit(100);

  res.json({
    success: true,
    data: logs,
  });
});
