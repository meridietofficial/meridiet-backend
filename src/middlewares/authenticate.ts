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
  tokenVersion?: number;
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

  try {
    const user = await findUserById(Number(payload.sub));
    if (!user) return errorResponse(res, 401, 'Session expired. Please log in again.');

    // Token version mismatch means password was changed — kill the session.
    // Old tokens without tokenVersion are treated as version 0 (DB default) for graceful rollout.
    if ((payload.tokenVersion ?? 0) !== user.token_version) {
      return errorResponse(res, 401, 'Session expired. Please log in again.');
    }
  } catch {
    return errorResponse(res, 500, 'Authentication error. Please try again.');
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
