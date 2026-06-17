import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authenticate';
import { getFollowUpsList } from '../controllers/appointment';

export const followUpsRouter = Router();

// GET /api/v1/follow-ups?tab=all&search=&page=1&limit=20
followUpsRouter.get('/', authenticate, authorize('dietitian'), getFollowUpsList);
