import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { errorResponse } from '../utils/response';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

// Adds req.user so it's available in all route handlers
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(res, 401, 'No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    return next();
  } catch {
    return errorResponse(res, 401, 'Invalid or expired token');
  }
};

// Usage: router.get('/admin', authenticate, authorize('admin'), handler)
export const authorize = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return errorResponse(res, 401, 'Not authenticated');
  if (!roles.includes(req.user.role)) return errorResponse(res, 403, 'Access denied');
  return next();
};
