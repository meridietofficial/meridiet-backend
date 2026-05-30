import { Router } from 'express';
import { registerDietitian } from '../controllers/dietitian';

export const dietitianRouter = Router();

dietitianRouter.post('/register', registerDietitian);
