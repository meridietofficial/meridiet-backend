import { Router } from 'express';
import { listDietitians, listSpecializations, getPublicDietitian, getPublicDietitianReviews } from '../controllers/publicDietitian';

// Public (no auth) endpoints powering the /consult-dietitian page.
export const dietitiansRouter = Router();

// GET /api/v1/dietitians/specializations  — category tabs (must precede /:id)
dietitiansRouter.get('/specializations', listSpecializations);

// GET /api/v1/dietitians  — filterable card grid of approved dietitians
dietitiansRouter.get('/', listDietitians);

// GET /api/v1/dietitians/:id/reviews  — public reviews for a single dietitian
dietitiansRouter.get('/:id/reviews', getPublicDietitianReviews);

// GET /api/v1/dietitians/:id  — public profile of a single dietitian
dietitiansRouter.get('/:id', getPublicDietitian);
