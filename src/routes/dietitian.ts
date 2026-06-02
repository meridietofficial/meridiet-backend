import { Router } from 'express';
import { registerDietitian, getDietitianProfile, getDietitianById, updateDietitianProfile } from '../controllers/dietitian';
import { authenticate, authorize } from '../middlewares/authenticate';

export const dietitianRouter = Router();

dietitianRouter.post('/register', registerDietitian);

// GET  /api/v1/dietitian/profile  — logged-in dietitian's own profile
dietitianRouter.get('/profile', authenticate, authorize('dietitian'), getDietitianProfile);

// PUT  /api/v1/dietitian/profile  — update logged-in dietitian's profile
dietitianRouter.put('/profile', authenticate, authorize('dietitian'), updateDietitianProfile);

// GET /api/v1/dietitian/:id  — any dietitian by ID (authenticated users)
dietitianRouter.get('/:id', authenticate, getDietitianById);
