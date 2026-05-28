import type { Request, Response, NextFunction } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { errorResponse } from '../utils/response';

// Global error handler — catches anything passed to next(err)
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);

  if (err instanceof TokenExpiredError) {
    return errorResponse(res, 401, 'Token has expired');
  }

  if (err instanceof JsonWebTokenError) {
    return errorResponse(res, 401, 'Invalid token');
  }

  // MySQL duplicate entry
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 1062) {
    return errorResponse(res, 409, (err as { sqlMessage?: string }).sqlMessage ?? 'Duplicate entry');
  }

  const message = err instanceof Error ? err.message : 'Something went wrong';
  return errorResponse(res, 500, message);
};
