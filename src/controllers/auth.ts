import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, findUserByPhone, findUserByPhoneNumber, checkPassword, findUserByGoogleId, linkGoogleId, createGoogleUser } from '../models/User';
import { findDietitianByUserId } from '../models/Dietitian';
import { env } from '../config/env';
import { successResponse, errorResponse } from '../utils/response';

const generateToken = (userId: number, email: string | null, role: string) => {
  return jwt.sign(
    { sub: userId, email, role },
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

    const user = await createUser({ full_name, email, password, phone_code, phone_number, role });
    if (!user) return errorResponse(res, 500, 'Failed to create user');

    const token = generateToken(user.id, user.email, user.role);

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

    if (role === 'dietitian') {
      const dietitian = await findDietitianByUserId(user.id);
      if (!dietitian || !dietitian.is_verified) {
        return errorResponse(res, 403, 'Your profile is currently under review. Our team will verify your details shortly. Please check back in 24–48 hours.');
      }
    }

    const isValid = await checkPassword(password, user.password);
    if (!isValid) return errorResponse(res, 401, 'Invalid credentials');

    const token = generateToken(user.id, user.email, user.role);

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
      },
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

    // Case 1: google_id already in DB — direct login
    user = await findUserByGoogleId(google_id);

    if (!user) {
      // Case 2: email exists, bind the google_id to it
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

    const token = generateToken(user.id, user.email, user.role);

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
      },
    });
  } catch (err) {
    console.error('Google login error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
