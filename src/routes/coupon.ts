import { Router } from 'express';
import { validateCoupon } from '../controllers/coupon';
import { optionalAuth } from '../middlewares/optionalAuth';

export const couponRouter = Router();

// POST /api/v1/coupons/validate
couponRouter.post('/validate', optionalAuth, validateCoupon);
