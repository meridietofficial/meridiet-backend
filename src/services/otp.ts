import crypto from 'crypto';
import { env } from '../config/env';
import { MSG91_HEADERS } from '../config/msg91';

const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow';

const toMsg91Mobile = (phoneCode: string, phoneNumber: string): string => {
  const code = phoneCode.replace(/\D/g, '');
  const number = phoneNumber.replace(/\D/g, '');
  // If phone_number already includes the country code, don't prepend it again
  if (number.startsWith(code)) return number;
  return `${code}${number}`;
};

export const generateOtp = (): string => {
  return String(crypto.randomInt(1000, 9999 + 1)).padStart(4, '0');
};

export const sendOtp = async (phoneCode: string, phoneNumber: string, otp: string) => {
  const mobile = toMsg91Mobile(phoneCode, phoneNumber);

  const res = await fetch(MSG91_FLOW_URL, {
    method: 'POST',
    headers: MSG91_HEADERS,
    body: JSON.stringify({
      template_id: env.MSG91_OTP_TEMPLATE_ID,
      recipients: [{ mobiles: mobile, OTP: otp }],
    }),
  });

  const body = (await res.json()) as { type: string; message?: string };
  return {
    ok: body.type === 'success',
    message: body.message ?? '',
  };
};

export const verifyOtp = async (
  _phoneCode: string,
  _phoneNumber: string,
  otp: string,
  storedOtp: string,
  expiresAt: Date,
): Promise<{ ok: boolean; message: string }> => {
  if (new Date() > expiresAt) return { ok: false, message: 'OTP has expired' };
  if (otp !== storedOtp) return { ok: false, message: 'Invalid OTP' };
  return { ok: true, message: 'OTP verified' };
};

export const resendOtp = async (phoneCode: string, phoneNumber: string, otp: string) => {
  return sendOtp(phoneCode, phoneNumber, otp);
};
