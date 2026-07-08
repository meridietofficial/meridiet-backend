import jwt from 'jsonwebtoken';
import { env } from '../config/env';

interface MeetingPayload {
  type: 'meeting';
  aid: number; // appointment id
  uid: number;
}

// UIDs are deterministic so both parties always get the same UID on rejoin
export const userUid       = (appointmentId: number) => appointmentId * 2;
export const dietitianUid  = (appointmentId: number) => appointmentId * 2 + 1;

export const generateMeetingToken = (appointmentId: number, uid: number): string =>
  jwt.sign(
    { type: 'meeting', aid: appointmentId, uid } satisfies MeetingPayload,
    env.JWT_SECRET,
    { expiresIn: '90d' },
  );

export const verifyMeetingToken = (token: string): { appointmentId: number; uid: number } | null => {
  try {
    const p = jwt.verify(token, env.JWT_SECRET) as MeetingPayload;
    if (p.type !== 'meeting') return null;
    return { appointmentId: p.aid, uid: p.uid };
  } catch {
    return null;
  }
};
