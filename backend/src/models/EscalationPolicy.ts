import { Schema, model, Document, Types } from 'mongoose';

export type EscalationChannel = 'email';

export interface IEscalationStep {
  order: number;
  timeoutMinutes: number;
  notifyUserId: Types.ObjectId;
  channel: EscalationChannel;
}

export interface IEscalationPolicy extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  serviceId: Types.ObjectId;
  name: string;
  steps: IEscalationStep[];
  repeatCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const escalationStepSchema = new Schema<IEscalationStep>(
  {
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    timeoutMinutes: {
      type: Number,
      required: true,
      min: 1,
      default: 5,
    },
    notifyUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    channel: {
      type: String,
      enum: ['email'],
      default: 'email',
    },
  },
  { _id: false }
);

const escalationPolicySchema = new Schema<IEscalationPolicy>(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    steps: {
      type: [escalationStepSchema],
      default: [],
    },
    repeatCount: {
      type: Number,
      default: 1,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

escalationPolicySchema.index({ organizationId: 1, serviceId: 1 });

export const EscalationPolicy = model<IEscalationPolicy>('EscalationPolicy', escalationPolicySchema);
