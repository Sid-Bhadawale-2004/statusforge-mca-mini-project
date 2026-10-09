import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'admin' | 'responder' | 'viewer';

export interface IUser extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  phone?: string;
  title?: string;
  googleId?: string;
  avatarUrl?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  invitationTokenHash?: string;
  invitationExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
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
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['admin', 'responder', 'viewer'],
      default: 'responder',
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    googleId: {
      type: String,
      default: null,
      index: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    invitationTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    invitationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ organizationId: 1, email: 1 });

export const User = model<IUser>('User', userSchema);
