import { Router } from 'express';
import { listActiveJobs, getJobById, applyForJob } from '../controllers/career';

export const careerRouter = Router();

// Public — no auth required
careerRouter.get ('/',          listActiveJobs);
careerRouter.get ('/:id',       getJobById);
careerRouter.post('/:id/apply', applyForJob);
