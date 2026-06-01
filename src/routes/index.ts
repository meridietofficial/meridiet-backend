import { Router } from 'express';
import { authRouter } from './auth';
import { dietFormRouter } from './dietForm';
import { paymentRouter } from './payment';
import { awsKeysRouter } from './awsKeys';
import { dietitianRouter } from './dietitian';
import { adminRouter } from './admin';

export const router = Router();

router.use('/auth', authRouter);
router.use('/diet-form', dietFormRouter);
router.use('/payment', paymentRouter);
router.use('/aws-keys', awsKeysRouter);
router.use('/dietitian', dietitianRouter);
router.use('/admin', adminRouter);
