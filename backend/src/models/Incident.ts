import { Schema, model, Document, Types } from 'mongoose';

export type IncidentStatus = 'triggered' | 'acknowledged' | 'resolved';
export type IncidentSeverity = 'P1' | 'P2' | 'P3' | 'P4';

export interface IIncident extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  serviceId: Types.ObjectId;
  incidentNumber: number;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  currentEscalationStep: number;
  assignedUserId?: Types.ObjectId | null;
  acknowledgedBy?: Types.ObjectId | null;
  acknowledgedAt?: Date | null;
  resolvedBy?: Types.ObjectId | null;
  resolvedAt?: Date | null;
  source: string;
  externalIncidentId?: string | null;
  rootCauseSummary?: string | null;
  lastEscalatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const incidentSchema = new Schema<IIncident>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    incidentNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['triggered', 'acknowledged', 'resolved'],
      default: 'triggered',
      index: true,
    },
    severity: {
      type: String,
      enum: ['P1', 'P2', 'P3', 'P4'],
      default: 'P2',
      index: true,
    },
    currentEscalationStep: {
      type: Number,
      default: 0,
    },
    assignedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    source: {
      type: String,
      default: 'manual',
      trim: true,
    },
    externalIncidentId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    rootCauseSummary: {
      type: String,
      default: null,
      trim: true,
    },
    lastEscalatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

incidentSchema.index({ organizationId: 1, incidentNumber: 1 }, { unique: true });
incidentSchema.index({ organizationId: 1, status: 1 });
incidentSchema.index({ organizationId: 1, createdAt: -1 });

export const Incident = model<IIncident>('Incident', incidentSchema);
