import { Router } from 'express';
import { getFee } from '../controllers/settings';

// Public site-wide settings (consultation fee, ...)
export const settingsRouter = Router();

// GET /api/v1/consultation-fee  — the one amount the whole site uses
settingsRouter.get('/consultation-fee', getFee);
