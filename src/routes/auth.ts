import { Router } from 'express';
import { register, login, googleLogin } from '../controllers/auth';

export const authRouter = Router();

// POST /api/v1/auth/register
authRouter.post('/register', register);

// POST /api/v1/auth/login
authRouter.post('/login', login);

// POST /api/v1/auth/google
authRouter.post('/google', googleLogin);
