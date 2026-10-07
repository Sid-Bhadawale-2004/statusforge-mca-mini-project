import { Schema, model, Document, Types } from 'mongoose';

export type NotificationChannel = 'email';
export type NotificationStatus = 'sent' | 'acknowledged' | 'failed';

export interface INotification extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  incidentId: Types.ObjectId;
  userId: Types.ObjectId;
  channel: NotificationChannel;
  status: NotificationStatus;
  subject: string;
  message: string;
  sentAt: Date;
}

const notificationSchema = new Schema<INotification>(
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['email'],
      default: 'email',
    },
    status: {
      type: String,
      enum: ['sent', 'acknowledged', 'failed'],
      default: 'sent',
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    sentAt: {
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

notificationSchema.index({ organizationId: 1, sentAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);
