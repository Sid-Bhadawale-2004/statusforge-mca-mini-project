import { Schema, model, Document, Types } from 'mongoose';

export type RotationType = 'daily' | 'weekly';

export interface IOnCallSchedule extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  serviceId: Types.ObjectId;
  name: string;
  rotationMembers: Types.ObjectId[];
  rotationType: RotationType;
  startDate: Date;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

const onCallScheduleSchema = new Schema<IOnCallSchedule>(
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
    rotationMembers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    rotationType: {
      type: String,
      enum: ['daily', 'weekly'],
      default: 'weekly',
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
  },
  {
    timestamps: true,
  }
);

onCallScheduleSchema.index({ organizationId: 1, serviceId: 1 });

export const OnCallSchedule = model<IOnCallSchedule>('OnCallSchedule', onCallScheduleSchema);
