import { Router } from 'express';
import { generateDietPlan, getDietPlan, previewDietPlanHtml, getSubscriptionStatus, redeemNextMonth } from '../controllers/dietPlan';
import { authenticate } from '../middlewares/authenticate';
import { optionalAuth } from '../middlewares/optionalAuth';

export const dietPlanRouter = Router();

// POST /api/v1/diet-plan/generate
dietPlanRouter.post('/generate', optionalAuth, generateDietPlan);

// GET /api/v1/diet-plan/subscription-status  (must be before /:form_id)
dietPlanRouter.get('/subscription-status', authenticate, getSubscriptionStatus);

// POST /api/v1/diet-plan/redeem-month
dietPlanRouter.post('/redeem-month', authenticate, redeemNextMonth);

// GET /api/v1/diet-plan/:form_id/preview-html  (must be before /:form_id)
dietPlanRouter.get('/:form_id/preview-html', previewDietPlanHtml);

// GET /api/v1/diet-plan/:form_id
dietPlanRouter.get('/:form_id', authenticate, getDietPlan);
