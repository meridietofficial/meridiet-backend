import { Router } from 'express';
import { submitPartnershipInquiry } from '../controllers/partnership';

export const partnershipRouter = Router();

// POST /api/v1/partnership-inquiry  — public partnership inquiry form
partnershipRouter.post('/', submitPartnershipInquiry);
