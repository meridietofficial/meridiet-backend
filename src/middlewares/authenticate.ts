import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { errorResponse } from '../utils/response';
import { findUserById } from '../models/User';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
}

// Adds req.user so it's available in all route handlers
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(res, 401, 'No token provided');
  }

  const token = authHeader.split(' ')[1];

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return errorResponse(res, 401, 'Invalid or expired token');
  }

  // Invalidate tokens issued before the last password change
  if (payload.iat) {
    const user = await findUserById(Number(payload.sub));
    if (user?.password_changed_at) {
      const changedAt = Math.floor(new Date(user.password_changed_at).getTime() / 1000);
      if (payload.iat < changedAt) {
        return errorResponse(res, 401, 'Session expired. Please log in again.');
      }
    }
  }

  req.user = payload;
  return next();
};

// Usage: router.get('/admin', authenticate, authorize('admin'), handler)
export const authorize = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return errorResponse(res, 401, 'Not authenticated');
  if (!roles.includes(req.user.role)) return errorResponse(res, 403, 'Access denied');
  return next();
};
