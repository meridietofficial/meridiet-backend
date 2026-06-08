import { Router } from 'express';
import { agoraWebhook } from '../controllers/appointment';

export const webhookRouter = Router();

// POST /webhooks/agora — Agora Message Notification Service (no auth)
webhookRouter.post('/agora', agoraWebhook);
