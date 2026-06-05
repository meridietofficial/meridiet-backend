import { env } from '../config/env';
import { MSG91_BASE_URL, MSG91_HEADERS } from '../config/msg91';

// MSG91 expects the mobile number with country code and NO leading "+", e.g. 919876543210.
// We accept a phone_code ("+91" or "91") and a 10-digit number and normalise it.
const toMsg91Mobile = (phoneCode: string, phoneNumber: string): string => {
  const code = phoneCode.replace(/\D/g, ''); // strip "+", spaces, etc.
  const number = phoneNumber.replace(/\D/g, '');
  return `${code}${number}`;
};

interface Msg91Response {
  type: 'success' | 'error';
  message: string;
  request_id?: string;
}

// MSG91 always returns HTTP 200; success/failure is in the body's `type` field.
const callMsg91 = async (
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; message: string; requestId?: string }> => {
  const res = await fetch(url, init);
  const body = (await res.json()) as Msg91Response;
  return {
    ok: body.type === 'success',
    message: body.message,
    requestId: body.request_id,
  };
};

/**
 * Send an OTP to a mobile number. MSG91 generates & stores the OTP against the
 * DLT-approved template, then delivers it via SMS.
 */
export const sendOtp = async (phoneCode: string, phoneNumber: string) => {
  const mobile = toMsg91Mobile(phoneCode, phoneNumber);

  const params = new URLSearchParams({
    template_id: env.MSG91_OTP_TEMPLATE_ID,
    mobile,
    otp_length: String(env.MSG91_OTP_LENGTH),
    otp_expiry: String(env.MSG91_OTP_EXPIRY_MINUTES),
  });

  return callMsg91(`${MSG91_BASE_URL}?${params.toString()}`, {
    method: 'POST',
    headers: MSG91_HEADERS,
  });
};

/**
 * Verify the OTP the user typed. MSG91 checks it against what it generated and
 * tracks expiry, so we don't need to store anything ourselves.
 */
export const verifyOtp = async (phoneCode: string, phoneNumber: string, otp: string) => {
  const mobile = toMsg91Mobile(phoneCode, phoneNumber);

  const params = new URLSearchParams({ mobile, otp });

  return callMsg91(`${MSG91_BASE_URL}/verify?${params.toString()}`, {
    method: 'GET',
    headers: MSG91_HEADERS,
  });
};

/**
 * Resend an OTP. channel "11" = text/SMS retry (use "10" for voice if enabled).
 */
export const resendOtp = async (phoneCode: string, phoneNumber: string) => {
  const mobile = toMsg91Mobile(phoneCode, phoneNumber);

  const params = new URLSearchParams({ mobile, retrytype: 'text' });

  return callMsg91(`${MSG91_BASE_URL}/retry?${params.toString()}`, {
    method: 'POST',
    headers: MSG91_HEADERS,
  });
};
