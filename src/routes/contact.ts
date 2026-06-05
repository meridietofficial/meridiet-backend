import { Router } from 'express';
import { submitContact } from '../controllers/contact';

export const contactRouter = Router();

// POST /api/v1/contact  — public contact / enquiry form submission
contactRouter.post('/', submitContact);
