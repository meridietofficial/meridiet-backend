import { Router } from 'express';
import { submitSponsorCohort } from '../controllers/sponsorCohort';

export const sponsorCohortRouter = Router();

// POST /api/v1/sponsor-cohort  — public sponsor cohort inquiry form
sponsorCohortRouter.post('/', submitSponsorCohort);
