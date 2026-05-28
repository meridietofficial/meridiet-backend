import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, findUserByPhone, findUserByPhoneNumber, checkPassword } from '../models/User';
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
    const { email_phone, password } = req.body;

    if (!email_phone || !password) {
      return errorResponse(res, 400, 'email_phone and password are required');
    }

    // If email_phone contains @ it's an email, otherwise it's a phone number
    const isEmail = (email_phone as string).includes('@');
    const user = isEmail
      ? await findUserByEmail(email_phone)
      : await findUserByPhoneNumber(email_phone);

    if (!user) return errorResponse(res, 401, 'Invalid credentials');

    if (!user.is_active) {
      return errorResponse(res, 403, 'Account is deactivated. Please contact support.');
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
