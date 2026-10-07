import { Schema, model, Document, Types } from 'mongoose';

export type PlanType = 'free' | 'pro';

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  plan: PlanType;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
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

export const Organization = model<IOrganization>('Organization', organizationSchema);
