import type { Request, Response } from 'express';
import { getConsultationFee } from '../models/Setting';
import { successResponse, errorResponse } from '../utils/response';

// GET /api/v1/consultation-fee
// Single source of truth for the consultation amount used across the whole site.
export const getFee = async (_req: Request, res: Response) => {
  try {
    const fee = await getConsultationFee();
    return successResponse(res, 200, 'Consultation fee fetched successfully', fee);
  } catch (err) {
    console.error('Get consultation fee error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
