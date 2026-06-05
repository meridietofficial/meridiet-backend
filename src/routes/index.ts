import { Router } from 'express';
import { authRouter } from './auth';
import { dietFormRouter } from './dietForm';
import { paymentRouter } from './payment';
import { awsKeysRouter } from './awsKeys';
import { dietitianRouter } from './dietitian';
import { dietitiansRouter } from './dietitians';
import { adminRouter } from './admin';
import { dietPlanRouter } from './dietPlan';
import { settingsRouter } from './settings';
import { contactRouter } from './contact';

export const router = Router();

router.use('/auth', authRouter);
router.use('/diet-form', dietFormRouter);
router.use('/payment', paymentRouter);
router.use('/aws-keys', awsKeysRouter);
router.use('/dietitian', dietitianRouter);
router.use('/dietitians', dietitiansRouter);
router.use('/admin', adminRouter);
router.use('/diet-plan', dietPlanRouter);
router.use('/contact', contactRouter);
router.use('/', settingsRouter);
