import { Router } from 'express';
import { register, login } from '../controllers/auth';

export const authRouter = Router();

// POST /api/v1/auth/register
authRouter.post('/register', register);

// POST /api/v1/auth/login
authRouter.post('/login', login);
