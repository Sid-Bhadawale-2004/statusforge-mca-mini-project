import { Router, Request, Response } from 'express';
import { Organization } from '../models/Organization.js';
import { Service, ServiceStatus } from '../models/Service.js';
import { Incident } from '../models/Incident.js';
import { IncidentEvent } from '../models/IncidentEvent.js';

export const publicRouter = Router();

// GET /api/v1/public/status/:slug
publicRouter.get('/status/:slug', async (req: Request, res: Response): Promise<void> => {
  const rawSlug = req.params.slug;
  const slug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) || '';

  const org = await Organization.findOne({ slug: slug.toLowerCase() });
  if (!org) {
    res.status(404).json({
      success: false,
      error: {
        code: 'ORGANIZATION_NOT_FOUND',
        message: `Status page for '${slug}' was not found.`,
      },
    });
    return;
  }

  // Fetch services for this organization
  const services = await Service.find({ organizationId: org._id })
    .select('name currentStatus description uptimePercentage updatedAt')
    .sort({ name: 1 });

  // Calculate overall health status
  let overallStatusCode: ServiceStatus = 'operational';
  const hasOutage = services.some((s) => s.currentStatus === 'outage');
  const hasDegraded = services.some((s) => s.currentStatus === 'degraded');

  if (hasOutage) {
    overallStatusCode = 'outage';
  } else if (hasDegraded) {
    overallStatusCode = 'degraded';
  }

  const overallHealthLabels: Record<ServiceStatus, string> = {
    operational: 'All Systems Operational',
    degraded: 'Partial System Degradation',
    outage: 'Major Service Outage',
  };

  // Fetch active incidents (sanitized without PII)
  const activeIncidentsRaw = await Incident.find({
    organizationId: org._id,
    status: { $ne: 'resolved' },
  })
    .populate('serviceId', 'name')
    .sort({ createdAt: -1 });

  const activeIncidents = await Promise.all(
    activeIncidentsRaw.map(async (inc) => {
      const updates = await IncidentEvent.find({
        incidentId: inc._id,
      })
        .select('type message timestamp')
        .sort({ timestamp: 1 });

      const svc: any = inc.serviceId;

      return {
        _id: inc._id,
        incidentNumber: inc.incidentNumber,
        serviceId: svc?._id || inc.serviceId,
        serviceName: svc?.name || 'Service',
        title: inc.title,
        description: inc.description,
        status: inc.status,
        severity: inc.severity,
        createdAt: inc.createdAt,
        acknowledgedAt: inc.acknowledgedAt,
        updatedAt: inc.updatedAt,
        updates: updates.map((u) => ({
          _id: u._id,
          type: u.type,
          message: u.message,
          timestamp: u.timestamp,
        })),
      };
    })
  );

  // Fetch resolved incidents from past 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const resolvedIncidentsRaw = await Incident.find({
    organizationId: org._id,
    status: 'resolved',
    resolvedAt: { $gte: sevenDaysAgo },
  })
    .populate('serviceId', 'name')
    .sort({ resolvedAt: -1 })
    .limit(15);

  const incidentHistory = await Promise.all(
    resolvedIncidentsRaw.map(async (inc) => {
      const updates = await IncidentEvent.find({
        incidentId: inc._id,
      })
        .select('type message timestamp')
        .sort({ timestamp: 1 });

      const svc: any = inc.serviceId;

      return {
        _id: inc._id,
        incidentNumber: inc.incidentNumber,
        serviceId: svc?._id || inc.serviceId,
        serviceName: svc?.name || 'Service',
        title: inc.title,
        description: inc.description,
        status: inc.status,
        severity: inc.severity,
        rootCauseSummary: inc.rootCauseSummary,
        createdAt: inc.createdAt,
        acknowledgedAt: inc.acknowledgedAt,
        resolvedAt: inc.resolvedAt,
        updatedAt: inc.updatedAt,
        updates: updates.map((u) => ({
          _id: u._id,
          type: u.type,
          message: u.message,
          timestamp: u.timestamp,
        })),
      };
    })
  );

  res.json({
    success: true,
    data: {
      organization: {
        name: org.name,
        slug: org.slug,
        timezone: org.timezone,
        updatedAt: org.updatedAt,
      },
      overallHealth: overallHealthLabels[overallStatusCode],
      overallStatusCode,
      services: services.map((s) => ({
        _id: s._id,
        name: s.name,
        currentStatus: s.currentStatus,
        publicStateLabel:
          s.currentStatus === 'operational'
            ? 'Operational'
            : s.currentStatus === 'degraded'
            ? 'Degraded Performance'
            : 'Major Outage',
        description: s.description,
        uptimePercentage: s.uptimePercentage,
        updatedAt: s.updatedAt,
      })),
      activeIncidents,
      incidentHistory,
    },
  });
});
