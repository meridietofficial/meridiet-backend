import { Router } from 'express';
import { meetingPage } from '../controllers/meet';

export const meetRouter = Router();

// GET /meet/:appointmentId?t=<signed-meeting-token>
// Serves a full Agora Web SDK video call page — no app required, works in any browser.
meetRouter.get('/:appointmentId', meetingPage);
