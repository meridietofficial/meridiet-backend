import { Router } from 'express';
import {
  getAvailableSlots,
  createAppointmentOrder,
  verifyAppointmentPayment,
  failAppointmentPayment,
  getMyAppointments,
  getDietitianAppointments,
  getDietitianSessions,
  getDietitianClients,
  updateAppointmentStatusHandler,
  cancelMyAppointment,
  joinCall,
  getCallRecording,
} from '../controllers/appointment';
import { authenticate, authorize } from '../middlewares/authenticate';
import { optionalAuth } from '../middlewares/optionalAuth';

export const appointmentRouter = Router();

// Public — no auth required
appointmentRouter.get('/slots/:dietitianId', getAvailableSlots);

// Payment flow — works for logged-in users and guests
appointmentRouter.post('/create-order', optionalAuth, createAppointmentOrder);
appointmentRouter.post('/verify', optionalAuth, verifyAppointmentPayment);
appointmentRouter.post('/failed', optionalAuth, failAppointmentPayment);

// User — must be logged in
appointmentRouter.get('/my', authenticate, getMyAppointments);
appointmentRouter.patch('/:id/cancel', authenticate, cancelMyAppointment);

// Dietitian — must be logged in as dietitian
appointmentRouter.get('/dietitian', authenticate, authorize('dietitian'), getDietitianAppointments);
appointmentRouter.get('/dietitian/sessions', authenticate, authorize('dietitian'), getDietitianSessions);
appointmentRouter.get('/clients', authenticate, authorize('dietitian'), getDietitianClients);
appointmentRouter.patch('/:id/status', authenticate, authorize('dietitian'), updateAppointmentStatusHandler);

// Video call — user or dietitian
// Recording auto-starts on first join (if video_recording_enabled = '1' in settings)
// and auto-stops via Agora's maxIdleTime when all participants leave.
appointmentRouter.post('/:id/join-call', authenticate, joinCall);
appointmentRouter.get('/:id/recording', authenticate, getCallRecording);
