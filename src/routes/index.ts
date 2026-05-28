import { Router } from 'express';
import { authRouter } from './auth';
import { dietFormRouter } from './dietForm';

export const router = Router();

router.use('/auth', authRouter);
router.use('/diet-form', dietFormRouter);
