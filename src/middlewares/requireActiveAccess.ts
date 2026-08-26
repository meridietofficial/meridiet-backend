import type { Request, Response, NextFunction } from 'express';
import { findDietitianByUserId } from '../models/Dietitian';
import { errorResponse } from '../utils/response';

// Applied to dietitian routes that require an active or in-trial account.
// Returns a specific error_code so the frontend can show the correct UI
// (pending review message vs. payment popup).
export const requireActiveAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user?.sub);
    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const status = dietitian.subscription_status;

    if (status === 'pending_approval') {
      return res.status(403).json({
        success:    false,
        error_code: 'PENDING_APPROVAL',
        message:    'Your profile is under review. You will be notified once approved.',
      });
    }

    if (status === 'expired') {
      return res.status(403).json({
        success:    false,
        error_code: 'REGISTRATION_FEE_REQUIRED',
        message:    'Your free trial has ended. Please complete your registration to continue.',
      });
    }

    if (status === 'trial') {
      const trialEnd = dietitian.trial_ends_at ? new Date(dietitian.trial_ends_at) : null;
      if (trialEnd && trialEnd < new Date()) {
        return res.status(403).json({
          success:    false,
          error_code: 'REGISTRATION_FEE_REQUIRED',
          message:    'Your free trial has ended. Please complete your registration to continue.',
        });
      }
    }

    // status === 'active' or valid trial — allow through
    next();
  } catch (err) {
    console.error('requireActiveAccess error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
