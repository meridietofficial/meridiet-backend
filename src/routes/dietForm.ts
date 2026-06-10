import { Router } from 'express';
import { submitDietForm, updateDietFormById, getDietFormById, getMyDietForm, getMyAllDietForms } from '../controllers/dietForm';
import { authenticate } from '../middlewares/authenticate';
import { optionalAuth } from '../middlewares/optionalAuth';

export const dietFormRouter = Router();

// POST /api/v1/diet-form
// Submit diet form — works for both logged-in users and guests
dietFormRouter.post('/', optionalAuth, submitDietForm);

// PUT /api/v1/diet-form/:id
// Update an existing diet form by id
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
