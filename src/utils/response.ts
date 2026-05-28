
import type { Response } from 'express';

// Meta interface
interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

// Validation error interface
export interface ValidationError {
  field?: string;
  message: string;
}

// Success envelope interface
interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T | null;
  meta?: Meta;
}

// Error envelope interface
interface ErrorEnvelope {
  success: false;
  message: string;
  errors?: ValidationError[] | unknown;
  code?: string;
}

// Success response handler
export const successResponse = <T>(
  res: Response,
  status: number,
  message: string,
  data?: T | null,
  meta?: Meta,
): void => {
  const body: SuccessEnvelope<T> = {
    success: true,
    message,
    data: data ?? null,
    ...(meta && { meta }),
  };
  res.status(status).json(body);
};

// Error response handler
export const errorResponse = (
  res: Response,
  status: number,
  message: string,
  errors?: ValidationError[] | unknown,
  code?: string,
): void => {
  const body: ErrorEnvelope = {
    success: false,
    message,
    ...(errors !== undefined && { errors }),
    ...(code && { code }),
  };
  res.status(status).json(body);
};
