import { Router } from 'express';
import { submitDietForm, finalizeDietForm, updateDietFormById, getDietFormById, getMyDietForm, getMyAllDietForms } from '../controllers/dietForm';
import { authenticate } from '../middlewares/authenticate';
import { optionalAuth } from '../middlewares/optionalAuth';

export const dietFormRouter = Router();

// POST /api/v1/diet-form
// Step 1: Create a draft diet form — no plan generation yet
dietFormRouter.post('/', optionalAuth, submitDietForm);

// POST /api/v1/diet-form/:id/submit
// Final submit: triggers plan generation + confirmation email (must come before /:id routes)
dietFormRouter.post('/:id/submit', finalizeDietForm);

// PUT /api/v1/diet-form/:id
// Steps 2–5: Partial update — only sent fields are saved
dietFormRouter.put('/:id', updateDietFormById);

// GET /api/v1/diet-form/my/all
// Get all diet forms submitted by the logged-in user with count (must come before /my and /:id)
dietFormRouter.get('/my/all', authenticate, getMyAllDietForms);

// GET /api/v1/diet-form/my
// Get the diet form of the currently logged-in user (must come before /:id)
dietFormRouter.get('/my', authenticate, getMyDietForm);

// GET /api/v1/diet-form/:id
// Get a diet form by id
dietFormRouter.get('/:id', getDietFormById);
