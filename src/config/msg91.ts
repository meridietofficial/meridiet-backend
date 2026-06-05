import { env } from './env';

// Base URL for MSG91's OTP API (v5).
// MSG91 generates, stores, and verifies the OTP server-side — we never store it.
export const MSG91_BASE_URL = 'https://control.msg91.com/api/v5/otp';

// Shared auth header sent on every MSG91 request.
export const MSG91_HEADERS = {
  authkey: env.MSG91_AUTH_KEY,
  'Content-Type': 'application/json',
};
