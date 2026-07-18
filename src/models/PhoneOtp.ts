import { query, execute } from '../config/database';
import { env } from '../config/env';

export interface PhoneOtp {
  id: number;
  phone_code: string;
  phone_number: string;
  otp: string;
  expires_at: Date;
  verified: boolean;
  created_at: Date;
}

export const saveOtp = async (phoneCode: string, phoneNumber: string, otp: string): Promise<void> => {
  const expiresAt = new Date(Date.now() + env.MSG91_OTP_EXPIRY_MINUTES * 60 * 1000);
  await execute(
    `INSERT INTO phone_otps (phone_code, phone_number, otp, expires_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE otp = VALUES(otp), expires_at = VALUES(expires_at), verified = 0`,
    [phoneCode, phoneNumber, otp, expiresAt],
  );
};

export const getLatestOtp = async (phoneCode: string, phoneNumber: string): Promise<PhoneOtp | null> => {
  const rows = await query<PhoneOtp>(
    `SELECT * FROM phone_otps
     WHERE phone_code = ? AND phone_number = ? AND verified = 0
     ORDER BY created_at DESC LIMIT 1`,
    [phoneCode, phoneNumber],
  );
  return rows[0] ?? null;
};

export const markOtpVerified = async (phoneCode: string, phoneNumber: string): Promise<void> => {
  await execute(
    `UPDATE phone_otps SET verified = 1
     WHERE phone_code = ? AND phone_number = ? AND verified = 0`,
    [phoneCode, phoneNumber],
  );
};

// Returns a verified OTP record if it was verified within the last 30 minutes
export const getVerifiedOtp = async (phoneCode: string, phoneNumber: string): Promise<PhoneOtp | null> => {
  const rows = await query<PhoneOtp>(
    `SELECT * FROM phone_otps
     WHERE phone_code = ? AND phone_number = ? AND verified = 1
       AND created_at >= NOW() - INTERVAL 30 MINUTE
     ORDER BY created_at DESC LIMIT 1`,
    [phoneCode, phoneNumber],
  );
  return rows[0] ?? null;
};

export const deleteOtps = async (phoneCode: string, phoneNumber: string): Promise<void> => {
  await execute(
    `DELETE FROM phone_otps WHERE phone_code = ? AND phone_number = ?`,
    [phoneCode, phoneNumber],
  );
};
