import { Schema, model, Document, Types } from 'mongoose';

export type IncidentEventType = 'created' | 'escalated' | 'acknowledged' | 'resolved' | 'comment';

export interface IIncidentEvent extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  incidentId: Types.ObjectId;
  type: IncidentEventType;
  message: string;
  actorUserId?: Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

const incidentEventSchema = new Schema<IIncidentEvent>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: 'Incident',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['created', 'escalated', 'acknowledged', 'resolved', 'comment'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

incidentEventSchema.index({ incidentId: 1, timestamp: 1 });

export const IncidentEvent = model<IIncidentEvent>('IncidentEvent', incidentEventSchema);
