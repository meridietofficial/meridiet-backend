import type { Request, Response, NextFunction } from 'express';
import type { AnyZodObject } from 'zod';
import { errorResponse } from '../utils/response';

// Validates req.body / req.query / req.params against a Zod schema
export const validate = (schema: AnyZodObject) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.slice(1).join('.'),
      message: e.message,
    }));
    return errorResponse(res, 422, 'Validation failed', errors);
  }

  req.body = (result.data as { body: unknown }).body ?? req.body;
  return next();
};
