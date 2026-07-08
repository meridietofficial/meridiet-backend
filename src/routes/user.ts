import { Router } from 'express';
import { getUserProfile, updateUserProfile, changeUserPassword } from '../controllers/user';
import { authenticate } from '../middlewares/authenticate';

export const userRouter = Router();

// GET  /api/v1/user/profile
userRouter.get('/profile', authenticate, getUserProfile);

// PUT  /api/v1/user/profile
userRouter.put('/profile', authenticate, updateUserProfile);

// PUT  /api/v1/user/change-password
userRouter.put('/change-password', authenticate, changeUserPassword);
