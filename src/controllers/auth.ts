import type { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, findUserByPhone, findUserByPhoneNumber, checkPassword, findUserByGoogleId, findDeletedUserByGoogleId, restoreDeletedUser, linkGoogleId, createGoogleUser, setPasswordResetToken, findUserByResetTokenHash, resetUserPassword } from '../models/User';
import { findDietitianByUserId, findDietitianById, formatDietitianRow } from '../models/Dietitian';
import { env } from '../config/env';
import { BRAND } from '../config/brand';
import { successResponse, errorResponse } from '../utils/response';
import { generateOtp, sendOtp, verifyOtp, resendOtp } from '../services/otp';
import { saveOtp, getLatestOtp, markOtpVerified } from '../models/PhoneOtp';
import { sendEmail } from '../services/email';
import { passwordResetEmail } from '../services/emails/passwordReset';
import { userWelcomeEmail } from '../services/emails/userWelcome';

// How long a password-reset link stays valid.
const RESET_TOKEN_TTL_MINUTES = 60;

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const generateToken = (userId: number, email: string | null, role: string, tokenVersion: number) => {
  return jwt.sign(
    { sub: userId, email, role, tokenVersion },
    env.JWT_SECRET,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as any,
  );
};

// POST /api/v1/auth/register
// Body: { full_name, password, email?, phone_code?, phone_number?, role? }
export const register = async (req: Request, res: Response) => {
  try {
    const { full_name, email, password, phone_code, phone_number, role } = req.body;

    if (!full_name || !password) {
      return errorResponse(res, 400, 'full_name and password are required');
    }

    if (!email && (!phone_code || !phone_number)) {
      return errorResponse(res, 400, 'Provide either email or phone_code + phone_number');
    }

    if (email) {
      const existing = await findUserByEmail(email);
      if (existing) return errorResponse(res, 409, 'Email is already registered');
    }

    if (phone_code && phone_number) {
      const existing = await findUserByPhone(phone_code, phone_number);
      if (existing) return errorResponse(res, 409, 'Phone number is already registered');
    }

    // Public register endpoint always creates a regular user — never admin.
    const safeRole = role === 'dietitian' ? 'dietitian' : 'user';
    const user = await createUser({ full_name, email, password, phone_code, phone_number, role: safeRole });
    if (!user) return errorResponse(res, 500, 'Failed to create user');

    const token = generateToken(user.id, user.email, user.role, user.token_version);

    if (user.email) {
      const { subject, html, text } = userWelcomeEmail(user.full_name);
      void sendEmail({ to: user.email, subject, html, text }).catch((mailErr) => {
        console.error('User welcome email failed:', mailErr);
      });
    }

    return successResponse(res, 201, 'Registration successful', {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_code: user.phone_code,
        phone_number: user.phone_number,
        role: user.role,
        avatar_url: user.avatar_url,
        wallet_balance: user.wallet_balance,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/auth/login
// Body: { email_phone, password }  — email_phone can be email or phone number
export const login = async (req: Request, res: Response) => {
  try {
    const { email_phone, password, role } = req.body;

    if (!email_phone || !password) {
      return errorResponse(res, 400, 'email_phone and password are required');
    }
    if (!role) {
      return errorResponse(res, 400, 'role is required');
    }
    if (!['user', 'admin', 'dietitian'].includes(role)) {
      return errorResponse(res, 400, 'role must be user, admin or dietitian');
    }

    // If email_phone contains @ it's an email, otherwise it's a phone number
    const isEmail = (email_phone as string).includes('@');
    const user = isEmail
      ? await findUserByEmail(email_phone)
      : await findUserByPhoneNumber(email_phone);

    if (!user) return errorResponse(res, 401, 'Invalid credentials');

    if (user.role !== role) {
      return errorResponse(res, 403, `This account is not registered as ${role}`);
    }

    if (!user.is_active) {
      return errorResponse(res, 403, 'Account is deactivated. Please contact support.');
    }

    let dietitianId: number | null = null;
    if (role === 'dietitian') {
      const dietitian = await findDietitianByUserId(user.id);
      if (!dietitian || !dietitian.is_verified) {
        return errorResponse(res, 403, 'Your profile is currently under review. Our team will verify your details shortly. Please check back in 24–48 hours.');
      }
      dietitianId = dietitian.id;
    }

    const isValid = await checkPassword(password, user.password);
    if (!isValid) return errorResponse(res, 401, 'Invalid credentials');

    const token = generateToken(user.id, user.email, user.role, user.token_version);

    // For dietitians, return the full profile so the client can run its validations.
    let dietitian = null;
    if (dietitianId != null) {
      const row = await findDietitianById(dietitianId);
      if (row) dietitian = formatDietitianRow(row);
    }

    return successResponse(res, 200, 'Login successful', {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_code: user.phone_code,
        phone_number: user.phone_number,
        role: user.role,
        avatar_url: user.avatar_url,
        wallet_balance: user.wallet_balance,
      },
      dietitian,
    });
  } catch (err) {
    console.error('Login error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/auth/google
// Body: { google_id, email, full_name, avatar_url?, user_type }
// Case 1 — google_id + email already in DB  → login
// Case 2 — email in DB, new google_id        → bind google_id then login
// Case 3 — neither in DB                     → register new user
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { google_id, email, full_name, avatar_url, user_type } = req.body as {
      google_id?: string;
      email?: string;
      full_name?: string;
      avatar_url?: string;
      user_type?: string;
    };

    if (!google_id) return errorResponse(res, 400, 'google_id is required');
    if (!email) return errorResponse(res, 400, 'email is required');
    if (!full_name) return errorResponse(res, 400, 'full_name is required');
    if (!user_type) return errorResponse(res, 400, 'user_type is required');
    if (!['user', 'dietitian'].includes(user_type)) {
      return errorResponse(res, 400, 'user_type must be user or dietitian');
    }

    let user = null;
    let action: 'login' | 'linked' | 'registered' = 'login';

    // Case 1: google_id already in DB (active) — direct login
    user = await findUserByGoogleId(google_id);

    if (!user) {
      // Case 1b: google_id belongs to a soft-deleted account — restore it
      const deleted = await findDeletedUserByGoogleId(google_id);
      if (deleted) {
        user = await restoreDeletedUser(deleted.id);
        action = 'login';
      }
    }

    if (!user) {
      // Case 2: email exists (active), bind the google_id to it
      const byEmail = await findUserByEmail(email);
      if (byEmail) {
        user = await linkGoogleId(byEmail.id, google_id, avatar_url ?? null);
        action = 'linked';
      } else {
        // Case 3: new user — register
        user = await createGoogleUser({
          google_id,
          email,
          full_name,
          avatar_url: avatar_url ?? null,
          role: user_type as 'user' | 'dietitian',
        });
        action = 'registered';
      }
    }

    if (!user) return errorResponse(res, 500, 'Failed to process Google login');

    if (!user.is_active) {
      return errorResponse(res, 403, 'Account is deactivated. Please contact support.');
    }

    const token = generateToken(user.id, user.email, user.role, user.token_version);

    const message =
      action === 'registered' ? 'Google registration successful' :
        action === 'linked' ? 'Google account linked and logged in' :
          'Google login successful';

    return successResponse(res, action === 'registered' ? 201 : 200, message, {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_code: user.phone_code,
        phone_number: user.phone_number,
        role: user.role,
        avatar_url: user.avatar_url,
        wallet_balance: user.wallet_balance,
      },
    });
  } catch (err) {
    console.error('Google login error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/auth/send-otp
// Body: { phone_code, phone_number }
// Sends an OTP via MSG91 to verify a mobile number before/at signup.
export const sendPhoneOtp = async (req: Request, res: Response) => {
  try {
    const { phone_code, phone_number } = req.body;

    if (!phone_code || !phone_number) {
      return errorResponse(res, 400, 'phone_code and phone_number are required');
    }

    // Don't send an OTP to a number that's already registered.
    const existing = await findUserByPhone(phone_code, phone_number);
    if (existing) return errorResponse(res, 409, 'Phone number is already registered');

    const otp = generateOtp();
    await saveOtp(phone_code, phone_number, otp);

    const result = await sendOtp(phone_code, phone_number, otp);
    if (!result.ok) return errorResponse(res, 502, result.message || 'Failed to send OTP');

    return successResponse(res, 200, 'OTP sent successfully');
  } catch (err) {
    console.error('Send OTP error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/auth/verify-otp
// Body: { phone_code, phone_number, otp }
// Verifies the OTP against DB. Frontend should proceed to /register on success.
export const verifyPhoneOtp = async (req: Request, res: Response) => {
  try {
    const { phone_code, phone_number, otp } = req.body;

    if (!phone_code || !phone_number || !otp) {
      return errorResponse(res, 400, 'phone_code, phone_number and otp are required');
    }

    const record = await getLatestOtp(phone_code, phone_number);
    if (!record) return errorResponse(res, 400, 'No OTP found. Please request a new one');

    const result = await verifyOtp(phone_code, phone_number, otp, record.otp, record.expires_at);
    if (!result.ok) return errorResponse(res, 400, result.message || 'Invalid or expired OTP');

    await markOtpVerified(phone_code, phone_number);

    return successResponse(res, 200, 'Phone number verified successfully', { verified: true });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/auth/resend-otp
// Body: { phone_code, phone_number }
export const resendPhoneOtp = async (req: Request, res: Response) => {
  try {
    const { phone_code, phone_number } = req.body;

    if (!phone_code || !phone_number) {
      return errorResponse(res, 400, 'phone_code and phone_number are required');
    }

    const otp = generateOtp();
    await saveOtp(phone_code, phone_number, otp);

    const result = await resendOtp(phone_code, phone_number, otp);
    if (!result.ok) return errorResponse(res, 502, result.message || 'Failed to resend OTP');

    return successResponse(res, 200, 'OTP resent successfully');
  } catch (err) {
    console.error('Resend OTP error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/auth/forgot-password
// Body: { email }
// Generates a reset token, emails a reset link. Always responds success so the
// endpoint can't be used to discover which emails are registered.
export const forgotPassword = async (req: Request, res: Response) => {
  // Generic message returned whether or not the email exists.
  const genericMessage = 'If an account exists for that email, a password reset link has been sent.';
  try {
    const { email } = req.body as { email?: string };
    if (!email) return errorResponse(res, 400, 'email is required');

    const user = await findUserByEmail(email);
    if (user && user.email) {
      // Raw token goes in the link; only its hash is stored.
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

      await setPasswordResetToken(user.id, tokenHash, expiresAt);

      const resetUrl = `${BRAND.resetPasswordUrl}?token=${rawToken}`;
      const { subject, html, text } = passwordResetEmail(user.full_name ?? '', resetUrl, RESET_TOKEN_TTL_MINUTES);
      try {
        await sendEmail({ to: user.email, subject, html, text });
      } catch (mailErr) {
        console.error('Password reset email failed:', mailErr);
      }
    }

    return successResponse(res, 200, genericMessage);
  } catch (err) {
    console.error('Forgot password error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/auth/reset-password
// Body: { token, password, confirm_password }
// Validates the token, sets the new password, and clears the token.
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password, confirm_password } = req.body as {
      token?: string;
      password?: string;
      confirm_password?: string;
    };

    if (!token) return errorResponse(res, 400, 'token is required');
    if (!password || !confirm_password) {
      return errorResponse(res, 400, 'password and confirm_password are required');
    }
    if (password.length < 6) {
      return errorResponse(res, 400, 'password must be at least 6 characters');
    }
    if (password !== confirm_password) {
      return errorResponse(res, 400, 'password and confirm_password do not match');
    }

    const user = await findUserByResetTokenHash(hashToken(token));
    if (!user) return errorResponse(res, 400, 'This reset link is invalid or has expired');

    await resetUserPassword(user.id, password);

    return successResponse(res, 200, 'Password reset successful. You can now log in with your new password.');
  } catch (err) {
    console.error('Reset password error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
