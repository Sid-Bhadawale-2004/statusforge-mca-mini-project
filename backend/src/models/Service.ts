import { Schema, model, Document, Types } from 'mongoose';

export type ServiceStatus = 'operational' | 'degraded' | 'outage';

export interface IService extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  currentStatus: ServiceStatus;
  description: string;
  webhookSecret: string;
  uptimePercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    currentStatus: {
      type: String,
      enum: ['operational', 'degraded', 'outage'],
      default: 'operational',
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    webhookSecret: {
      type: String,
      required: true,
      trim: true,
    },
    uptimePercentage: {
      type: Number,
      default: 100.0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

serviceSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Service = model<IService>('Service', serviceSchema);
