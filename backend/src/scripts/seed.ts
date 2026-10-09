import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { Service } from '../models/Service.js';
import { OnCallSchedule } from '../models/OnCallSchedule.js';
import { EscalationPolicy } from '../models/EscalationPolicy.js';
import { Incident } from '../models/Incident.js';
import { IncidentEvent } from '../models/IncidentEvent.js';
import { Notification } from '../models/Notification.js';
import { AuditLog } from '../models/AuditLog.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirectory, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/statusforge';

async function seed() {
  const seedPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (
    !seedPassword ||
    seedPassword.length < 12 ||
    /replace|change.?me|example/i.test(seedPassword)
  ) {
    throw new Error('Set SEED_DEFAULT_PASSWORD to a unique password of at least 12 characters in backend/.env before seeding.');
  }

  console.log('[StatusForge Seed] Connecting to the configured MongoDB database...');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('[StatusForge Seed] Connected to MongoDB.');

  const orgSlug = 'acme-engineering';

  // 1. Clean existing Acme Engineering records if already present
  const existingOrg = await Organization.findOne({ slug: orgSlug });
  if (existingOrg) {
    console.log(`[StatusForge Seed] Cleaning existing records for organization '${orgSlug}'...`);
    const orgId = existingOrg._id;
    await IncidentEvent.deleteMany({ organizationId: orgId });
    await Notification.deleteMany({ organizationId: orgId });
    await Incident.deleteMany({ organizationId: orgId });
    await EscalationPolicy.deleteMany({ organizationId: orgId });
    await OnCallSchedule.deleteMany({ organizationId: orgId });
    await Service.deleteMany({ organizationId: orgId });
    await AuditLog.deleteMany({ organizationId: orgId });
    await User.deleteMany({ organizationId: orgId });
    await Organization.deleteOne({ _id: orgId });
  }

  // 2. Create Organization
  console.log('[StatusForge Seed] Creating Organization: Acme Engineering...');
  const organization = await Organization.create({
    name: 'Acme Engineering',
    slug: orgSlug,
    plan: 'pro',
    timezone: 'America/New_York',
  });

  // 3. Create Users
  console.log('[StatusForge Seed] Seeding 4 Users (Admin, 2 Responders, Viewer)...');
  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash(seedPassword, salt);

  const adminUser = await User.create({
    organizationId: organization._id,
    name: 'Alex Rivera',
    email: 'admin@acme.com',
    passwordHash: commonPasswordHash,
    role: 'admin',
    phone: '+1-555-0101',
    title: 'VP of Reliability & Platform',
  });

  const responderSarah = await User.create({
    organizationId: organization._id,
    name: 'Sarah Chen',
    email: 'sarah.ops@acme.com',
    passwordHash: commonPasswordHash,
    role: 'responder',
    phone: '+1-555-0102',
    title: 'Principal SRE',
  });

  const responderDavid = await User.create({
    organizationId: organization._id,
    name: 'David Kim',
    email: 'david.dev@acme.com',
    passwordHash: commonPasswordHash,
    role: 'responder',
    phone: '+1-555-0103',
    title: 'Core Backend Lead',
  });

  const viewerUser = await User.create({
    organizationId: organization._id,
    name: 'Elena Rostova',
    email: 'stakeholder@acme.com',
    passwordHash: commonPasswordHash,
    role: 'viewer',
    phone: '+1-555-0104',
    title: 'Product Director',
  });

  // 4. Create Services
  console.log('[StatusForge Seed] Seeding 4 Monitored Microservices...');
  const gatewayService = await Service.create({
    organizationId: organization._id,
    name: 'Primary API Gateway',
    currentStatus: 'outage',
    description: 'High-availability public API entry point and edge traffic routing cluster',
    webhookSecret: crypto.randomBytes(32).toString('hex'),
    uptimePercentage: 98.42,
  });

  const paymentService = await Service.create({
    organizationId: organization._id,
    name: 'Payment Processing Engine',
    currentStatus: 'degraded',
    description: 'Stripe, PayPal, and ledger transactions settlement pipeline',
    webhookSecret: crypto.randomBytes(32).toString('hex'),
    uptimePercentage: 99.18,
  });

  const authService = await Service.create({
    organizationId: organization._id,
    name: 'Auth & Identity Service',
    currentStatus: 'operational',
    description: 'OAuth2, JWT authentication, user sessions, and SAML single sign-on',
    webhookSecret: crypto.randomBytes(32).toString('hex'),
    uptimePercentage: 99.99,
  });

  const notificationService = await Service.create({
    organizationId: organization._id,
    name: 'Real-time Notification Worker',
    currentStatus: 'operational',
    description: 'Kafka-driven asynchronous email notification dispatcher',
    webhookSecret: crypto.randomBytes(32).toString('hex'),
    uptimePercentage: 100.0,
  });

  // 5. Create On-Call Schedules
  console.log('[StatusForge Seed] Seeding On-Call Schedules & Rotations...');
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const gatewaySchedule = await OnCallSchedule.create({
    organizationId: organization._id,
    serviceId: gatewayService._id,
    name: 'Gateway Tier-1 On-Call',
    rotationMembers: [responderSarah._id, responderDavid._id],
    rotationType: 'weekly',
    startDate: twoWeeksAgo,
    timezone: 'America/New_York',
  });

  const paymentSchedule = await OnCallSchedule.create({
    organizationId: organization._id,
    serviceId: paymentService._id,
    name: 'FinTech Systems Rotation',
    rotationMembers: [responderDavid._id, responderSarah._id],
    rotationType: 'daily',
    startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    timezone: 'America/New_York',
  });

  await OnCallSchedule.create({
    organizationId: organization._id,
    serviceId: authService._id,
    name: 'Security & Auth Rotation',
    rotationMembers: [adminUser._id, responderSarah._id],
    rotationType: 'weekly',
    startDate: twoWeeksAgo,
    timezone: 'America/New_York',
  });

  await OnCallSchedule.create({
    organizationId: organization._id,
    serviceId: notificationService._id,
    name: 'Notification Core Rotation',
    rotationMembers: [responderDavid._id, adminUser._id],
    rotationType: 'weekly',
    startDate: twoWeeksAgo,
    timezone: 'America/New_York',
  });

  // 6. Create Escalation Policies
  console.log('[StatusForge Seed] Seeding Multi-Step Escalation Policies...');
  const gatewayPolicy = await EscalationPolicy.create({
    organizationId: organization._id,
    serviceId: gatewayService._id,
    name: 'API Gateway Critical Escalation Policy',
    steps: [
      {
        order: 1,
        timeoutMinutes: 5,
        notifyUserId: responderSarah._id,
        channel: 'email',
      },
      {
        order: 2,
        timeoutMinutes: 10,
        notifyUserId: responderDavid._id,
        channel: 'email',
      },
      {
        order: 3,
        timeoutMinutes: 15,
        notifyUserId: adminUser._id,
        channel: 'email',
      },
    ],
    repeatCount: 1,
  });

  await EscalationPolicy.create({
    organizationId: organization._id,
    serviceId: paymentService._id,
    name: 'Payment Tier Escalation Policy',
    steps: [
      {
        order: 1,
        timeoutMinutes: 5,
        notifyUserId: responderDavid._id,
        channel: 'email',
      },
      {
        order: 2,
        timeoutMinutes: 10,
        notifyUserId: responderSarah._id,
        channel: 'email',
      },
      {
        order: 3,
        timeoutMinutes: 15,
        notifyUserId: adminUser._id,
        channel: 'email',
      },
    ],
    repeatCount: 1,
  });

  await EscalationPolicy.create({
    organizationId: organization._id,
    serviceId: authService._id,
    name: 'Identity Escalation Policy',
    steps: [
      {
        order: 1,
        timeoutMinutes: 10,
        notifyUserId: responderSarah._id,
        channel: 'email',
      },
      {
        order: 2,
        timeoutMinutes: 20,
        notifyUserId: adminUser._id,
        channel: 'email',
      },
    ],
    repeatCount: 1,
  });

  await EscalationPolicy.create({
    organizationId: organization._id,
    serviceId: notificationService._id,
    name: 'Notification Worker Escalation Policy',
    steps: [
      {
        order: 1,
        timeoutMinutes: 15,
        notifyUserId: responderDavid._id,
        channel: 'email',
      },
    ],
    repeatCount: 1,
  });

  // 7. Create Sample Incidents
  console.log('[StatusForge Seed] Seeding Incidents, Timeline Events, & Notifications...');

  // Incident 1001: P1 Critical Outage (Triggered, Unacknowledged)
  const incident1001 = await Incident.create({
    organizationId: organization._id,
    serviceId: gatewayService._id,
    incidentNumber: 1001,
    title: 'CRITICAL: Envoy Ingress Rate-Limiter Segfaulting on Edge Cluster',
    description:
      'Edge ingress pods in us-east-1 are crash looping due to a null pointer segfault in Envoy rate-limiting filter. 503 errors spike to 48% across public API endpoints.',
    severity: 'P1',
    status: 'triggered',
    currentEscalationStep: 0,
    assignedUserId: responderSarah._id,
    source: 'datadog_webhook',
    externalIncidentId: 'dd-alert-99214',
    lastEscalatedAt: new Date(Date.now() - 4 * 60 * 1000), // 4 mins ago (almost due for step 1 escalation)
    createdAt: new Date(Date.now() - 4 * 60 * 1000),
  });

  await IncidentEvent.create({
    organizationId: organization._id,
    incidentId: incident1001._id,
    type: 'created',
    message: 'Triggered by automated Datadog webhook alert (dd-alert-99214). Assigned to active on-call: Sarah Chen.',
    actorUserId: null,
    metadata: { source: 'datadog_webhook', externalId: 'dd-alert-99214' },
    timestamp: new Date(Date.now() - 4 * 60 * 1000),
  });

  await Notification.create({
    organizationId: organization._id,
    incidentId: incident1001._id,
    userId: responderSarah._id,
    channel: 'email',
    status: 'sent',
    subject: '[P1 ALERT] Incident #1001: CRITICAL: Envoy Ingress Rate-Limiter Segfaulting on Edge Cluster',
    message:
      'A P1 incident has been triggered on Primary API Gateway. Edge ingress pods are crash looping. Immediate response required.',
    sentAt: new Date(Date.now() - 4 * 60 * 1000),
  });

  // Incident 1002: P2 Degraded (Acknowledged)
  const incident1002 = await Incident.create({
    organizationId: organization._id,
    serviceId: paymentService._id,
    incidentNumber: 1002,
    title: 'Stripe Webhook Delivery Queue Backlog Exceeding 15,000 Messages',
    description:
      'Redis stream consumer group for payment webhooks has lagged behind. Customers may experience up to 4 minutes delay in payment confirmation screens.',
    severity: 'P2',
    status: 'acknowledged',
    currentEscalationStep: 0,
    assignedUserId: responderDavid._id,
    acknowledgedBy: responderDavid._id,
    acknowledgedAt: new Date(Date.now() - 15 * 60 * 1000),
    source: 'prometheus_alertmanager',
    externalIncidentId: 'prom-queue-backlog-338',
    createdAt: new Date(Date.now() - 25 * 60 * 1000),
  });

  await IncidentEvent.create({
    organizationId: organization._id,
    incidentId: incident1002._id,
    type: 'created',
    message: 'Incident triggered via Prometheus Alertmanager. Assigned to David Kim.',
    actorUserId: null,
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
  });

  await IncidentEvent.create({
    organizationId: organization._id,
    incidentId: incident1002._id,
    type: 'acknowledged',
    message: 'Incident acknowledged by David Kim. Escalation timer halted.',
    actorUserId: responderDavid._id,
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
  });

  await IncidentEvent.create({
    organizationId: organization._id,
    incidentId: incident1002._id,
    type: 'comment',
    message: 'Scaled Redis consumer pods from 3 to 12. Queue lag is draining at 1,200 msg/sec.',
    actorUserId: responderDavid._id,
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
  });

  await Notification.create({
    organizationId: organization._id,
    incidentId: incident1002._id,
    userId: responderDavid._id,
    channel: 'email',
    status: 'acknowledged',
    subject: '[P2 ALERT] Incident #1002: Stripe Webhook Delivery Queue Backlog',
    message: 'Stripe webhook queue has exceeded threshold. David Kim acknowledged.',
    sentAt: new Date(Date.now() - 25 * 60 * 1000),
  });

  // Incident 1003: P3 Resolved (Past incident with Root Cause)
  const incident1003 = await Incident.create({
    organizationId: organization._id,
    serviceId: authService._id,
    incidentNumber: 1003,
    title: 'Elevated 401 Spike Due to Expired JWKS Cache in Regional Edge',
    description:
      'Users in EU-West experienced intermittent 401 Unauthorized errors when validating fresh asymmetric JWT tokens.',
    severity: 'P3',
    status: 'resolved',
    currentEscalationStep: 0,
    assignedUserId: adminUser._id,
    acknowledgedBy: adminUser._id,
    acknowledgedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    resolvedBy: adminUser._id,
    resolvedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    rootCauseSummary:
      'Edge Cloudflare worker caching JWKS public keys past TTL. Cache invalidated and automated rotation refreshed.',
    source: 'manual',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  });

  await IncidentEvent.create({
    organizationId: organization._id,
    incidentId: incident1003._id,
    type: 'created',
    message: 'Manual incident opened by Alex Rivera.',
    actorUserId: adminUser._id,
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
  });

  await IncidentEvent.create({
    organizationId: organization._id,
    incidentId: incident1003._id,
    type: 'acknowledged',
    message: 'Acknowledged by Alex Rivera.',
    actorUserId: adminUser._id,
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
  });

  await IncidentEvent.create({
    organizationId: organization._id,
    incidentId: incident1003._id,
    type: 'resolved',
    message:
      'Incident resolved by Alex Rivera. Root Cause: Edge Cloudflare worker caching JWKS public keys past TTL.',
    actorUserId: adminUser._id,
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
  });

  // 8. Create Audit Logs
  await AuditLog.create({
    organizationId: organization._id,
    actorUserId: adminUser._id,
    actorName: adminUser.name,
    actorRole: adminUser.role,
    action: 'INITIAL_SEED',
    resourceType: 'Organization',
    resourceId: organization._id.toString(),
    ipAddress: '127.0.0.1',
    metadata: { note: 'Initial StatusForge Acme Engineering seed populated.' },
    timestamp: new Date(),
  });

  console.log('\n=============================================================');
  console.log('STATUSFORGE MONGODB SEEDING COMPLETED SUCCESSFULLY!');
  console.log('=============================================================');
  console.log('Database:          configured MongoDB instance');
  console.log(`Organization Name: ${organization.name}`);
  console.log(`Organization Slug: ${organization.slug}`);
  console.log(`Public Status URL: http://localhost:3000/status/${organization.slug}`);
  console.log('\nSeeded accounts use the password configured in SEED_DEFAULT_PASSWORD.');
  console.log('  1. Admin:        admin@acme.com        (Alex Rivera - Full Platform Access)');
  console.log('  2. Responder 1:  sarah.ops@acme.com    (Sarah Chen - Principal SRE)');
  console.log('  3. Responder 2:  david.dev@acme.com    (David Kim - Backend Lead)');
  console.log('  4. Viewer:       stakeholder@acme.com  (Elena Rostova - Read Only)');
  console.log('\nMonitored Services:');
  console.log('  - Primary API Gateway (Outage)');
  console.log('  - Payment Processing Engine (Degraded)');
  console.log('  - Auth & Identity Service (Operational)');
  console.log('  - Real-time Notification Worker (Operational)');
  console.log('=============================================================\n');

}

async function runSeed(): Promise<void> {
  let failed = false;

  try {
    await seed();
  } catch (error) {
    failed = true;
    console.error('[StatusForge Seed] Failed:', error);
  }

  try {
    await mongoose.disconnect();
  } catch (error) {
    failed = true;
    console.error('[StatusForge Seed] Failed to close the MongoDB connection:', error);
  }

  if (failed) process.exitCode = 1;
}

void runSeed();
