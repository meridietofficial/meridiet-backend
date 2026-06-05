import { Router } from 'express';
import { generateDietPlan, getDietPlan } from '../controllers/dietPlan';
import { authenticate } from '../middlewares/authenticate';
import { optionalAuth } from '../middlewares/optionalAuth';

export const dietPlanRouter = Router();

// POST /api/v1/diet-plan/generate
dietPlanRouter.post('/generate', optionalAuth, generateDietPlan);

// GET /api/v1/diet-plan/:form_id
dietPlanRouter.get('/:form_id', authenticate, getDietPlan);
