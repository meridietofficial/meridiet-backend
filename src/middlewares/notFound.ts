import type { Request, Response } from 'express';
import { errorResponse } from '../utils/response';

export const notFound = (req: Request, res: Response) => {
  errorResponse(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};
