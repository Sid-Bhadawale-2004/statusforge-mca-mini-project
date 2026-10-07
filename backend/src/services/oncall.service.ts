import { Types } from 'mongoose';
import { IOnCallSchedule, RotationType } from '../models/OnCallSchedule.js';
import { IUser, User } from '../models/User.js';

export interface ShiftInfo {
  responder: IUser | null;
  start: Date;
  end: Date;
  isCurrent: boolean;
}

export interface OnCallCalculationResult {
  currentResponder: IUser | null;
  upcomingResponder: IUser | null;
  currentShiftStart: Date;
  currentShiftEnd: Date;
  forecast: ShiftInfo[];
}

export class OnCallService {
  private static getShiftDurationMs(rotationType: RotationType): number {
    if (rotationType === 'daily') {
      return 24 * 60 * 60 * 1000;
    }
    // weekly
    return 7 * 24 * 60 * 60 * 1000;
  }

  public static async calculateOnCall(
    schedule: any,
    now: Date = new Date()
  ): Promise<OnCallCalculationResult> {
    const shiftDurationMs = this.getShiftDurationMs(schedule.rotationType);
    const startMs = new Date(schedule.startDate).getTime();
    const nowMs = now.getTime();

    // Populate rotation members if they are just ObjectIds
    let members: IUser[] = [];
    if (schedule.rotationMembers && schedule.rotationMembers.length > 0) {
      if (typeof (schedule.rotationMembers[0] as any).email === 'string') {
        members = schedule.rotationMembers as IUser[];
      } else {
        const userDocs = await User.find({ _id: { $in: schedule.rotationMembers } });
        // Preserve original ordering from rotationMembers
        const userMap = new Map(userDocs.map((u) => [u._id.toString(), u as IUser]));
        members = schedule.rotationMembers
          .map((id: any) => userMap.get(id.toString()))
          .filter((u: any): u is IUser => Boolean(u));
      }
    }

    if (members.length === 0) {
      const fallbackEnd = new Date(nowMs + shiftDurationMs);
      return {
        currentResponder: null,
        upcomingResponder: null,
        currentShiftStart: now,
        currentShiftEnd: fallbackEnd,
        forecast: [],
      };
    }

    // Determine current shift index
    let shiftsElapsed = 0;
    if (nowMs >= startMs) {
      shiftsElapsed = Math.floor((nowMs - startMs) / shiftDurationMs);
    } else {
      shiftsElapsed = 0;
    }

    const currentIndex = shiftsElapsed % members.length;
    const upcomingIndex = (shiftsElapsed + 1) % members.length;

    const currentShiftStart = new Date(startMs + shiftsElapsed * shiftDurationMs);
    const currentShiftEnd = new Date(currentShiftStart.getTime() + shiftDurationMs);

    const currentResponder = members[currentIndex] || null;
    const upcomingResponder = members[upcomingIndex] || null;

    // Build 5-shift forecast
    const forecast: ShiftInfo[] = [];
    for (let i = 0; i < 5; i++) {
      const shiftIndex = (shiftsElapsed + i) % members.length;
      const sStart = new Date(startMs + (shiftsElapsed + i) * shiftDurationMs);
      const sEnd = new Date(sStart.getTime() + shiftDurationMs);
      forecast.push({
        responder: members[shiftIndex] || null,
        start: sStart,
        end: sEnd,
        isCurrent: i === 0,
      });
    }

    return {
      currentResponder,
      upcomingResponder,
      currentShiftStart,
      currentShiftEnd,
      forecast,
    };
  }

  public static async getActiveResponderForService(
    organizationId: Types.ObjectId | string,
    serviceId: Types.ObjectId | string
  ): Promise<IUser | null> {
    const { OnCallSchedule } = await import('../models/OnCallSchedule.js');
    const schedule = await OnCallSchedule.findOne({
      organizationId,
      serviceId,
    }).populate<{ rotationMembers: IUser[] }>('rotationMembers');

    if (!schedule || !schedule.rotationMembers || schedule.rotationMembers.length === 0) {
      return null;
    }

    const result = await this.calculateOnCall(schedule);
    return result.currentResponder;
  }
}
