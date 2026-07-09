import { Router } from 'express';
import {
  getAvailableSlots,
  createAppointmentOrder,
  verifyAppointmentPayment,
  failAppointmentPayment,
  getMyAppointments,
  getDietitianAppointments,
  getDietitianSessions,
  getDietitianDashboard,
  getDietitianClients,
  updateAppointmentStatusHandler,
  cancelMyAppointment,
  joinCall,
  leaveCall,
  getCallRecording,
  scheduleFollowUp,
  getAppointmentFollowUps,
  getAppointmentById,
  saveDietitianNotes,
  getDietitianNotes,
  rescheduleAppointmentHandler,
  getAppointmentRescheduleHistory,
  markMissedHandler,
  getRescheduleSlots,
  submitReview,
  getAppointmentReviews,
  getDietitianReviewsList,
  getAppointmentDietForm,
  getFollowUpSlots,
  trackUserJoin,
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
appointmentRouter.get('/dietitian/dashboard', authenticate, authorize('dietitian'), getDietitianDashboard);
appointmentRouter.get('/dietitian/reviews', authenticate, authorize('dietitian'), getDietitianReviewsList);
appointmentRouter.get('/clients', authenticate, authorize('dietitian'), getDietitianClients);
// /:id must come after all static routes to avoid swallowing them
appointmentRouter.get('/:id', authenticate, authorize('dietitian'), getAppointmentById);
appointmentRouter.patch('/:id/status', authenticate, authorize('dietitian'), updateAppointmentStatusHandler);
appointmentRouter.get('/:id/reschedule-slots', authenticate, authorize('dietitian'), getRescheduleSlots);
appointmentRouter.patch('/:id/mark-missed', authenticate, authorize('dietitian'), markMissedHandler);
appointmentRouter.patch('/:id/reschedule', authenticate, authorize('dietitian'), rescheduleAppointmentHandler);
appointmentRouter.get('/:id/reschedule-history', authenticate, authorize('dietitian', 'admin'), getAppointmentRescheduleHistory);

// Dietitian notes — dietitian only, never exposed to patients
appointmentRouter.put('/:id/dietitian-notes', authenticate, authorize('dietitian'), saveDietitianNotes);
appointmentRouter.get('/:id/dietitian-notes', authenticate, authorize('dietitian'), getDietitianNotes);

// Diet form — dietitian only
appointmentRouter.get('/:id/diet-form', authenticate, authorize('dietitian'), getAppointmentDietForm);

// Reviews — user or dietitian
appointmentRouter.post('/:id/review', authenticate, submitReview);
appointmentRouter.get('/:id/reviews', authenticate, getAppointmentReviews);

// Follow-up appointments
appointmentRouter.get('/:id/follow-up-slots', authenticate, authorize('dietitian'), getFollowUpSlots);
appointmentRouter.post('/:id/follow-up', authenticate, authorize('dietitian'), scheduleFollowUp);
appointmentRouter.get('/:id/follow-ups', authenticate, getAppointmentFollowUps);

// Video call — user or dietitian
// Recording auto-starts on first join (if video_recording_enabled = '1' in settings)
// and auto-stops via Agora's maxIdleTime when all participants leave.
appointmentRouter.post('/:id/join-call', authenticate, joinCall);
appointmentRouter.post('/:id/leave-call', authenticate, leaveCall);
appointmentRouter.get('/:id/recording', authenticate, getCallRecording);
// No login required — verified by meeting JWT from the URL
appointmentRouter.post('/:id/track-join', trackUserJoin);
