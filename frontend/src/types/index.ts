export type UserRole = 'admin' | 'responder' | 'viewer';
export type ServiceStatus = 'operational' | 'degraded' | 'outage';
export type IncidentStatus = 'triggered' | 'acknowledged' | 'resolved';
export type IncidentSeverity = 'P1' | 'P2' | 'P3' | 'P4';
export type RotationType = 'daily' | 'weekly';
export type NotificationChannel = 'email';
export type NotificationStatus = 'sent' | 'failed' | 'acknowledged';
export type IncidentEventType = 'created' | 'escalated' | 'acknowledged' | 'resolved' | 'comment';

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro';
  timezone: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceItem {
  _id: string;
  organizationId: string;
  name: string;
  currentStatus: ServiceStatus;
  description: string;
  webhookSecret: string;
  uptimePercentage: number;
  onCallResponder?: User | null;
  upcomingResponder?: User | null;
  scheduleName?: string;
  escalationPolicyName?: string;
  escalationStepsCount?: number;
  activeIncidentsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftPreview {
  responder: User | null;
  start: string;
  end: string;
  isCurrent: boolean;
}

export interface OnCallSchedule {
  _id: string;
  organizationId: string;
  serviceId: string;
  serviceName: string;
  serviceStatus: ServiceStatus;
  name: string;
  rotationMembers: User[] | string[];
  rotationType: RotationType;
  startDate: string;
  timezone: string;
  currentResponder?: User | null;
  upcomingResponder?: User | null;
  shiftStartsAt?: string;
  shiftEndsAt?: string;
  shiftsPreview?: ShiftPreview[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EscalationStep {
  order: number;
  timeoutMinutes: number;
  notifyUserId: string;
  channel: NotificationChannel;
  user?: User | null;
}

export interface EscalationPolicy {
  _id: string;
  organizationId: string;
  serviceId: string;
  serviceName?: string;
  name: string;
  steps: EscalationStep[];
  repeatCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface IncidentEvent {
  _id: string;
  organizationId: string;
  incidentId: string;
  type: IncidentEventType;
  message: string;
  actorUserId?: string | null;
  actor?: User | null;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface NotificationItem {
  _id: string;
  organizationId: string;
  incidentId: string;
  userId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  subject: string;
  message: string;
  sentAt: string;
  recipient?: User | null;
}

export interface Incident {
  _id: string;
  organizationId: string;
  serviceId: any; // populated Service or ID
  incidentNumber: number;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  currentEscalationStep: number;
  assignedUserId?: any;
  acknowledgedBy?: any;
  acknowledgedAt?: string | null;
  resolvedBy?: any;
  resolvedAt?: string | null;
  source: string;
  externalIncidentId?: string | null;
  rootCauseSummary?: string | null;
  events?: IncidentEvent[];
  notifications?: NotificationItem[];
  escalationPolicy?: EscalationPolicy | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogItem {
  _id: string;
  organizationId: string;
  actorUserId?: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AnalyticsOverview {
  totalIncidents: number;
  activeIncidents: number;
  triggeredCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  avgMttaSeconds: number;
  avgMttrMinutes: number;
  bySeverity: {
    P1: number;
    P2: number;
    P3: number;
    P4: number;
  };
  serviceBreakdown: Array<{
    serviceId: string;
    name: string;
    currentStatus: ServiceStatus;
    uptimePercentage: number;
    totalIncidents: number;
    activeIncidents: number;
  }>;
  notificationsSent: number;
  deliverySuccessRate: number;
}

export interface PublicStatusResponse {
  organization: {
    name: string;
    slug: string;
    timezone: string;
    updatedAt: string;
  };
  overallHealth: string;
  overallStatusCode: ServiceStatus;
  services: Array<{
    _id: string;
    name: string;
    currentStatus: ServiceStatus;
    publicStateLabel: string;
    description: string;
    uptimePercentage: number;
    updatedAt: string;
  }>;
  activeIncidents: Array<{
    _id: string;
    incidentNumber: number;
    serviceId: string;
    serviceName: string;
    title: string;
    description: string;
    status: IncidentStatus;
    severity: IncidentSeverity;
    createdAt: string;
    acknowledgedAt?: string | null;
    updatedAt: string;
    updates: Array<{
      _id: string;
      type: IncidentEventType;
      message: string;
      timestamp: string;
    }>;
  }>;
  incidentHistory: Array<{
    _id: string;
    incidentNumber: number;
    serviceId: string;
    serviceName: string;
    title: string;
    description: string;
    status: IncidentStatus;
    severity: IncidentSeverity;
    rootCauseSummary?: string | null;
    createdAt: string;
    acknowledgedAt?: string | null;
    resolvedAt?: string | null;
    updatedAt: string;
    updates: Array<{
      _id: string;
      type: IncidentEventType;
      message: string;
      timestamp: string;
    }>;
  }>;
}
