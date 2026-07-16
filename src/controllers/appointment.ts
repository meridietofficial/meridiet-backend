import crypto from 'crypto';
import type { Request, Response } from 'express';
import { razorpay } from '../config/razorpay';
import { env } from '../config/env';
import {
  AGORA_RECORDING_UID,
  CALL_MAX_SECONDS,
  generateRtcToken,
  agoraAcquire,
  agoraStartRecording,
} from '../config/agora';
import { getSetting } from '../models/Setting';
import { findDietitianById, findDietitianByUserId } from '../models/Dietitian';
import {
  createAppointment,
  findAppointmentById,
  findAppointmentByOrderId,
  findAppointmentsByUserId,
  findAppointmentsByDietitianId,
  getDietitianSessionsList,
  getDietitianDashboardStats,
  getClientsByDietitianId,
  updateAppointmentStatus,
  updateAppointmentPayment,
  markAppointmentCancelled,
  getBookedSlots,
  isSlotTaken,
  findUnpaidSlotAppointment,
  updateAppointmentOnRetry,
  setAgoraChannel,
  endCallSession,
  markUserJoined,
  markDietitianJoined,
  markCallLeft,
  updateRecordingStarted,
  updateCallEnded,
  updateRecordingUrl,
  findAppointmentByChannelName,
  findFollowUpsByAppointmentId,
  findAppointmentDetailById,
  saveUserReview,
  saveDietitianReview,
  getDietitianReviews,
  updateDietitianNotes,
  rescheduleAppointment,
  markAppointmentMissedWithType,
  markPaymentApproved,
  getFollowUpListSummary,
  listFollowUpAppointments,
  MissedType,
  type FollowUpListTab,
} from '../models/Appointment';
import { buildAvailableDates } from '../utils/availability';
import { resolveCoupon, createCouponUsage } from '../models/Coupon';
import { successResponse, errorResponse } from '../utils/response';
import { createRescheduleHistory, getRescheduleHistory, countRescheduleHistory } from '../models/AppointmentRescheduleHistory';
import { findDietFormByAppointmentId } from '../models/DietForm';
import { findDietPlanByAppointmentId } from '../models/DietPlan';
import { sendEmail } from '../services/email';
import { appointmentConfirmationEmail, appointmentConfirmedEmail, followUpScheduledEmail } from '../services/emails/appointmentConfirmation';
import { appointmentNewBookingEmail } from '../services/emails/appointmentNewBooking';
import { appointmentRescheduledUserEmail, appointmentRescheduledDietitianEmail } from '../services/emails/appointmentRescheduled';
import { appointmentCompletedEmail } from '../services/emails/appointmentCompleted';
import {
  sendAppointmentBookedWhatsApp,
  sendDietitianNewBookingWhatsApp,
  sendAppointmentConfirmedWhatsApp,
  sendFollowUpScheduledWhatsApp,
  sendAppointmentRescheduledWhatsApp,
  sendDietitianRescheduledWhatsApp,
  sendAppointmentCompletedWhatsApp,
} from '../services/whatsapp';
import { generateMeetingToken, verifyMeetingToken, userUid, dietitianUid } from '../utils/meetingToken';

// GET /api/v1/appointments/slots/:dietitianId?days=14
export const getAvailableSlots = async (req: Request, res: Response) => {
  try {
    const dietitianId = Number(req.params.dietitianId);
    if (isNaN(dietitianId)) return errorResponse(res, 400, 'Invalid dietitian ID');

    const days = Math.min(Number(req.query.days) || 14, 60);

    const dietitian = await findDietitianById(dietitianId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian not found');

    const schedule = typeof dietitian.availability === 'string'
      ? JSON.parse(dietitian.availability)
      : (dietitian.availability ?? null);

    const availableDates = buildAvailableDates(schedule, days);
    if (availableDates.length === 0) {
      return successResponse(res, 200, 'No available slots', []);
    }

    const fromDate = availableDates[0].date;
    const booked = await getBookedSlots(dietitianId, fromDate);

    // Build a Set of "date|slot" strings for O(1) lookup
    const bookedSet = new Set(booked.map((b) => `${b.appointment_date}|${b.slot}`));

    const filtered = availableDates
      .map((d) => ({
        date: d.date,
        day: d.day,
        slots: d.slots.filter((s) => !bookedSet.has(`${d.date}|${s}`)),
      }))
      .filter((d) => d.slots.length > 0);

    return successResponse(res, 200, 'Available slots fetched', filtered);
  } catch (err) {
    console.error('Get available slots error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_INDEX: Record<string, number> = {};
DAY_NAMES.forEach((name, i) => {
  DAY_INDEX[name.toLowerCase()] = i;
  DAY_INDEX[name.slice(0, 3).toLowerCase()] = i;
});

// Checks if a "HH:MM" slot falls within any of the dietitian's ranges (e.g. "09:00-18:00")
// Also handles exact match for individual slot format (e.g. "09:30")
const isSlotWithinSchedule = (slot: string, ranges: string[]): boolean => {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const slotMins = toMinutes(slot);
  for (const range of ranges) {
    if (range.includes('-')) {
      const [start, end] = range.split('-');
      if (slotMins >= toMinutes(start) && slotMins < toMinutes(end)) return true;
    } else {
      if (range === slot) return true;
    }
  }
  return false;
};

// POST /api/v1/appointments/create-order
// Body: { dietitian_id, appointment_date, slot, name, email?, phone?, notes? }
export const createAppointmentOrder = async (req: Request, res: Response) => {
  try {
    const {
      dietitian_id,
      appointment_date,
      slot,
      name,
      email,
      phone,
      duration,
      session_type,
      notes,
      coupon_code,
    } = req.body as {
      dietitian_id?: number;
      appointment_date?: string;
      slot?: string;
      name?: string;
      email?: string;
      phone?: string;
      duration?: number;
      session_type?: 'video_call' | 'in_person';
      notes?: string;
      coupon_code?: string;
    };

    if (!dietitian_id) return errorResponse(res, 400, 'dietitian_id is required');
    if (!appointment_date) return errorResponse(res, 400, 'appointment_date is required');
    if (!slot) return errorResponse(res, 400, 'slot is required');
    if (!name) return errorResponse(res, 400, 'name is required');

    // Validate slot format HH:MM
    if (!/^\d{2}:\d{2}$/.test(slot)) {
      return errorResponse(res, 400, 'slot must be in HH:MM format (e.g. "09:30")');
    }

    // Validate date format and ensure it is not in the past
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment_date)) {
      return errorResponse(res, 400, 'appointment_date must be in YYYY-MM-DD format');
    }
    const [yr, mo, dy] = appointment_date.split('-').map(Number);
    const requestedDate = new Date(yr, mo - 1, dy);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      return errorResponse(res, 400, 'appointment_date cannot be in the past');
    }

    const dietitian = await findDietitianById(dietitian_id);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian not found');

    // --- Slot availability check ---
    const schedule: Record<string, string[]> | null =
      typeof dietitian.availability === 'string'
        ? JSON.parse(dietitian.availability)
        : (dietitian.availability ?? null);

    if (!schedule) return errorResponse(res, 400, 'Dietitian has no availability configured');

    const dayIndex = requestedDate.getDay();
    const dayName = DAY_NAMES[dayIndex];

    // Find the slots configured for that day of week
    const scheduledSlots = Object.entries(schedule).find(
      ([key]) => DAY_INDEX[key.trim().toLowerCase()] === dayIndex,
    )?.[1];

    if (!scheduledSlots || scheduledSlots.length === 0) {
      return errorResponse(res, 400, `Dietitian is not available on ${dayName}`);
    }
    if (!isSlotWithinSchedule(slot, scheduledSlots)) {
      return errorResponse(res, 400, `Slot "${slot}" is outside the dietitian's hours on ${dayName}. Available: ${scheduledSlots.join(', ')}`);
    }

    // Check if this slot is already paid/confirmed
    const taken = await isSlotTaken(dietitian_id, appointment_date, slot);
    if (taken) {
      return errorResponse(res, 409, 'This slot is already booked. Please choose another.');
    }
    // --- End availability check ---

    const fee = Number(dietitian.appointment_fee ?? 0);
    if (Math.round(fee * 100) < 100) {
      return errorResponse(res, 400, 'This dietitian has not set a valid appointment fee (minimum ₹1)');
    }
    const currency = (dietitian.appointment_currency as string) || 'INR';
    const userId = req.user?.sub ? Number(req.user.sub) : null;

    // Resolve coupon if provided
    let couponId: number | null = null;
    let discountApplied: number | null = null;
    let finalAmount: number = fee;

    if (coupon_code) {
      const couponResult = await resolveCoupon(coupon_code, 'appointment', fee, null, userId);
      if ('error' in couponResult) {
        const status = couponResult.error === 'Invalid or expired coupon code' ? 404 : 400;
        return errorResponse(res, status, couponResult.error);
      }
      couponId = couponResult.coupon.id;
      discountApplied = couponResult.discountApplied;
      finalAmount = couponResult.finalAmount;
    }

    const chargeInPaise = Math.round(finalAmount * 100);

    // If the same user previously opened Razorpay but cancelled without paying,
    // their unpaid appointment row still holds the unique slot in the DB.
    // Reuse that row with a fresh Razorpay order instead of creating a duplicate.
    const staleAppointment = await findUnpaidSlotAppointment(dietitian_id, appointment_date, slot, userId);
    if (staleAppointment) {
      const freshOrder = await razorpay.orders.create({
        amount: chargeInPaise,
        currency,
        receipt: `appt_${Date.now()}`,
      });
      await updateAppointmentOnRetry(staleAppointment.id, freshOrder.id, couponId, discountApplied, coupon_code ? finalAmount : null);
      return successResponse(res, 201, 'Order created', {
        appointment_id:   staleAppointment.id,
        order_id:         freshOrder.id,
        amount:           fee,
        final_amount:     finalAmount,
        discount_applied: discountApplied ?? 0,
        currency,
        key_id:           env.RAZORPAY_KEY_ID,
      });
    }

    // Create Razorpay order only after all checks pass
    const order = await razorpay.orders.create({
      amount: chargeInPaise,
      currency,
      receipt: `appt_${Date.now()}`,
    });

    const appointment = await createAppointment({
      dietitian_id,
      user_id: userId,
      name,
      email: email ?? null,
      phone: phone ?? null,
      appointment_date,
      slot,
      duration: duration ?? 30,
      session_type: session_type ?? 'video_call',
      fee,
      currency,
      order_id: order.id,
      coupon_id: couponId,
      discount_applied: discountApplied,
      final_amount: coupon_code ? finalAmount : null,
      notes: notes ?? null,
    });

    if (!appointment) return errorResponse(res, 500, 'Failed to reserve appointment slot');

    return successResponse(res, 201, 'Order created', {
      appointment_id:   appointment.id,
      order_id:         order.id,
      amount:           fee,
      final_amount:     finalAmount,
      discount_applied: discountApplied ?? 0,
      currency,
      key_id:           env.RAZORPAY_KEY_ID,
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      // Another user holds an unpaid reservation on this slot — it hasn't been paid yet
      // but the DB unique constraint prevents a second row. Ask the user to retry shortly.
      return errorResponse(res, 409, 'This slot is temporarily held by another booking. Please try again in a few minutes or choose a different slot.');
    }
    console.error('Create appointment order error:', err);
    return errorResponse(res, 500, 'Failed to create appointment order');
  }
};

// POST /api/v1/appointments/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
export const verifyAppointmentPayment = async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return errorResponse(res, 400, 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
  }

  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    await markAppointmentCancelled(razorpay_order_id).catch(() => null);
    return errorResponse(res, 400, 'Payment verification failed: invalid signature');
  }

  try {
    const appointment = await findAppointmentByOrderId(razorpay_order_id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found for this order');

    if (appointment.payment_status === 'paid') {
      return errorResponse(res, 409, 'Payment already verified');
    }

    if (appointment.status === 'cancelled') {
      return errorResponse(res, 409, 'This appointment slot was cancelled. Please book again.');
    }

    await updateAppointmentPayment(razorpay_order_id, razorpay_payment_id, 'paid', 'pending');

    // Record coupon usage now that payment is confirmed
    if (appointment.coupon_id && appointment.discount_applied != null && appointment.final_amount != null) {
      await createCouponUsage({
        coupon_id:        appointment.coupon_id,
        user_id:          appointment.user_id,
        applicable_type:  'appointment',
        payment_id:       null,
        appointment_id:   appointment.id,
        original_amount:  appointment.fee,
        discount_applied: appointment.discount_applied,
        final_amount:     appointment.final_amount,
      }).catch((e) => console.error('[appointment] Failed to record coupon usage:', e));
    }

    // Fire notifications in background — don't let failures block the response
    setImmediate(async () => {
      try {
        const dietitian = await findDietitianById(appointment.dietitian_id);
        const dietitianName = dietitian?.full_name ?? 'Your Dietitian';

        // Generate meeting links for video call appointments
        const isVideoCall = appointment.session_type === 'video_call';
        const baseUrl = env.APP_BASE_URL ?? 'http://localhost:3000';
        const userJoinUrl = isVideoCall
          ? `${baseUrl}/meet/${appointment.id}?t=${generateMeetingToken(appointment.id, userUid(appointment.id))}`
          : undefined;

        // Email to user
        if (appointment.email) {
          const userMail = appointmentConfirmationEmail({
            userName: appointment.name,
            dietitianName,
            appointmentDate: appointment.appointment_date,
            slot: appointment.slot,
            sessionType: appointment.session_type,
            fee: appointment.fee,
            currency: appointment.currency,
            joinUrl: userJoinUrl,
          });
          await sendEmail({ to: appointment.email, subject: userMail.subject, html: userMail.html, text: userMail.text })
            .catch((e) => console.error('[appointment] User confirmation email failed:', e));
        }

        // Email to dietitian
        if (dietitian?.email) {
          const dietMail = appointmentNewBookingEmail({
            dietitianName,
            patientName: appointment.name,
            appointmentDate: appointment.appointment_date,
            slot: appointment.slot,
            sessionType: appointment.session_type,
            notes: appointment.notes,
          });
          await sendEmail({ to: dietitian.email, subject: dietMail.subject, html: dietMail.html, text: dietMail.text })
            .catch((e) => console.error('[appointment] Dietitian new-booking email failed:', e));
        }

        // WhatsApp to user
        if (appointment.phone) {
          await sendAppointmentBookedWhatsApp(
            appointment.phone,
            appointment.name,
            appointment.appointment_date,
            appointment.slot,
            userJoinUrl,
          ).catch((e) => console.error('[appointment] User WhatsApp failed:', e));
        }

        // WhatsApp to dietitian
        if (dietitian?.phone_number) {
          const dietitianPhone = dietitian.phone_code
            ? `${dietitian.phone_code}${dietitian.phone_number}`
            : dietitian.phone_number;
          await sendDietitianNewBookingWhatsApp(
            dietitianPhone,
            dietitianName,
            appointment.name,
            appointment.appointment_date,
            appointment.slot,
          ).catch((e) => console.error('[appointment] Dietitian WhatsApp failed:', e));
        }
      } catch (e) {
        console.error('[appointment] Post-payment notification error:', e);
      }
    });

    return successResponse(res, 200, 'Payment verified. Awaiting dietitian confirmation.', {
      appointment_id: appointment.id,
      status: 'pending',
      payment_status: 'paid',
      appointment_date: appointment.appointment_date,
      slot: appointment.slot,
    });
  } catch (err) {
    console.error('Verify appointment payment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/appointments/failed
// Body: { razorpay_order_id }
export const failAppointmentPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id } = req.body as { razorpay_order_id?: string };
    if (!razorpay_order_id) return errorResponse(res, 400, 'razorpay_order_id is required');

    await markAppointmentCancelled(razorpay_order_id);
    return successResponse(res, 200, 'Appointment cancelled due to payment failure');
  } catch (err) {
    console.error('Fail appointment payment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/my?page=1&limit=10
export const getMyAppointments = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const { appointments, total } = await findAppointmentsByUserId(userId, page, limit);

    const baseUrl = env.APP_BASE_URL ?? 'http://localhost:5000';
    const appointmentsWithJoin = appointments.map((a) => ({
      ...a,
      join_url:
        a.session_type === 'video_call' && a.status === 'confirmed'
          ? `${baseUrl}/meet/${a.id}?t=${generateMeetingToken(a.id, userUid(a.id))}`
          : null,
    }));

    return successResponse(res, 200, 'Appointments fetched', appointmentsWithJoin, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Get my appointments error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/:id
// Dietitian only — returns a single appointment only if it belongs to them.
// Returns avatar_url from users table; email and phone are excluded.
export const getAppointmentById = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const appointment = await findAppointmentDetailById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');
    if (appointment.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    const dietPlan = await findDietPlanByAppointmentId(id);
    const diet_plan = dietPlan
      ? {
          id:         dietPlan.id,
          form_id:    dietPlan.form_id,
          status:     dietPlan.status,
          pdf_url:    dietPlan.pdf_url ?? null,
        }
      : null;

    return successResponse(res, 200, 'Appointment fetched', { ...appointment, diet_plan });
  } catch (err) {
    console.error('Get appointment by ID error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/dietitian?page=1&limit=10&status=confirmed
export const getDietitianAppointments = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const status = req.query.status as string | undefined;

    const allowedStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'missed'];
    if (status && !allowedStatuses.includes(status)) {
      return errorResponse(res, 400, `status must be one of: ${allowedStatuses.join(', ')}`);
    }

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const { appointments, total } = await findAppointmentsByDietitianId(dietitian.id, page, limit, status);

    return successResponse(res, 200, 'Appointments fetched', appointments, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Get dietitian appointments error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PATCH /api/v1/appointments/:id/status
// Body: { status: 'confirmed' | 'completed' | 'cancelled' }
export const updateAppointmentStatusHandler = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const { status } = req.body as { status?: string };
    const allowed = ['confirmed', 'completed', 'cancelled', 'missed'] as const;
    if (!status || !allowed.includes(status as typeof allowed[number])) {
      return errorResponse(res, 400, `status must be one of: ${allowed.join(', ')}`);
    }

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');
    if (appointment.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    await updateAppointmentStatus(id, status as 'confirmed' | 'completed' | 'cancelled');

    // Notify user when dietitian confirms
    if (status === 'confirmed') {
      setImmediate(async () => {
        try {
          const fullDietitian = await findDietitianById(appointment.dietitian_id);
          const dietitianName = fullDietitian?.full_name ?? 'Your Dietitian';
          const isVideoCall = appointment.session_type === 'video_call';
          const baseUrl = env.APP_BASE_URL ?? 'http://localhost:3000';
          const userJoinUrl = isVideoCall
            ? `${baseUrl}/meet/${id}?t=${generateMeetingToken(id, userUid(id))}`
            : undefined;

          if (appointment.email) {
            const mail = appointmentConfirmedEmail({
              userName: appointment.name,
              dietitianName,
              appointmentDate: appointment.appointment_date,
              slot: appointment.slot,
              sessionType: appointment.session_type,
              joinUrl: userJoinUrl,
            });
            await sendEmail({ to: appointment.email, subject: mail.subject, html: mail.html, text: mail.text })
              .catch((e) => console.error('[confirm] User email failed:', e));
          }

          if (appointment.phone) {
            await sendAppointmentConfirmedWhatsApp(
              appointment.phone,
              appointment.name,
              appointment.appointment_date,
              appointment.slot,
              userJoinUrl,
            ).catch((e) => console.error('[confirm] User WhatsApp failed:', e));
          }
        } catch (e) {
          console.error('[confirm] Notification error:', e);
        }
      });
    }

    // Close the video call channel when appointment is marked completed
    if (status === 'completed' && appointment.session_type === 'video_call') {
      await endCallSession(id).catch((e) => console.error('[completed] endCallSession failed:', e));
    }

    // Payment credit is handled by admin via POST /admin/appointments/:id/approve-payment

    // Notify user when appointment is completed — prompt them to rate the dietitian
    if (status === 'completed') {
      setImmediate(async () => {
        try {
          const fullDietitian = await findDietitianById(appointment.dietitian_id);
          const dietitianName = fullDietitian?.full_name ?? 'Your Dietitian';
          const rateUrl = `${env.APP_FRONTEND_URL}/profile?tab=appointments`;

          if (appointment.email) {
            const mail = appointmentCompletedEmail({
              userName: appointment.name,
              dietitianName,
              appointmentDate: appointment.appointment_date,
              slot: appointment.slot,
              rateUrl,
            });
            await sendEmail({ to: appointment.email, subject: mail.subject, html: mail.html, text: mail.text })
              .catch((e) => console.error('[completed] User email failed:', e));
          }

          if (appointment.phone) {
            await sendAppointmentCompletedWhatsApp(
              appointment.phone,
              appointment.name,
              appointment.appointment_date,
              appointment.slot,
            ).catch((e) => console.error('[completed] User WhatsApp failed:', e));
          }
        } catch (e) {
          console.error('[completed] Notification error:', e);
        }
      });
    }

    return successResponse(res, 200, 'Appointment status updated', { id, status });
  } catch (err) {
    console.error('Update appointment status error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const toAmPm = (slot: string) => {
  const [h, m] = slot.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
};

// GET /api/v1/appointments/dietitian/sessions
export const getDietitianSessions = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const page  = Math.max(Number(req.query.page)  || 1,  1);
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const search = typeof req.query.search === 'string' && req.query.search.trim()
      ? req.query.search.trim() : undefined;

    const allowed = ['all', 'upcoming', 'completed', 'cancelled', 'missed'] as const;
    const tab = allowed.includes(req.query.tab as typeof allowed[number])
      ? req.query.tab as typeof allowed[number]
      : 'all';

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const { summary, rows, total } = await getDietitianSessionsList(dietitian.id, tab, search, page, limit);

    // Group rows by date — label is computed on the frontend in local timezone
    const dateMap = new Map<string, { date: string; count: number; sessions: unknown[] }>();
    for (const row of rows) {
      if (!dateMap.has(row.appointment_date)) {
        dateMap.set(row.appointment_date, {
          date: row.appointment_date,
          count: 0,
          sessions: [],
        });
      }
      const group = dateMap.get(row.appointment_date)!;
      group.count++;
      group.sessions.push({
        id:                   row.id,
        time:                 toAmPm(row.slot),
        slot:                 row.slot,
        duration:             row.duration,
        session_type:         row.session_type,
        status:               row.status,
        payment_status:       row.payment_status,
        notes:                row.notes,
        session_number:       Number(row.session_number),
        is_follow_up:         Boolean(row.is_follow_up),
        parent_appointment_id: row.parent_appointment_id ?? null,
        user_review_done:     Boolean(row.user_review_done),
        dietitian_review_done: Boolean(row.dietitian_review_done),
        diet_plan: row.diet_plan_id
          ? { id: row.diet_plan_id, form_id: row.diet_plan_form_id, status: row.diet_plan_status }
          : null,
        client: {
          user_id:    row.user_id,
          name:       row.client_name,
          initials:   getInitials(row.client_name),
          avatar_url: row.client_avatar,
        },
      });
    }

    return successResponse(
      res, 200, 'Sessions fetched successfully',
      { summary, grouped: [...dateMap.values()] },
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    );
  } catch (err) {
    console.error('Get dietitian sessions error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/clients?page=1&limit=10
export const getDietitianClients = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const { clients, total } = await getClientsByDietitianId(dietitian.id, page, limit);

    return successResponse(res, 200, 'Clients fetched successfully', clients, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Get dietitian clients error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/dietitian/dashboard
export const getDietitianDashboard = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const stats = await getDietitianDashboardStats(dietitian.id);

    const todayChange = stats.yesterday_count > 0
      ? Math.round(((stats.today_count - stats.yesterday_count) / stats.yesterday_count) * 100)
      : stats.today_count > 0 ? 100 : 0;

    const earningsChange = stats.last_month_earnings > 0
      ? Math.round(((stats.this_month_earnings - stats.last_month_earnings) / stats.last_month_earnings) * 100)
      : stats.this_month_earnings > 0 ? 100 : 0;

    return successResponse(res, 200, 'Dashboard stats fetched', {
      today_consultations: {
        count: stats.today_count,
        change_percent: Math.abs(todayChange),
        change_direction: todayChange >= 0 ? 'up' : 'down',
      },
      pending_requests: {
        count: stats.pending_count,
      },
      upcoming_appointments: {
        count: stats.upcoming_count,
        next_slot: stats.next_slot ? toAmPm(stats.next_slot) : null,
        next_date: stats.next_date,
      },
      monthly_earnings: {
        amount: stats.this_month_earnings,
        currency: 'INR',
        change_percent: Math.abs(earningsChange),
        change_direction: earningsChange >= 0 ? 'up' : 'down',
      },
    });
  } catch (err) {
    console.error('Get dietitian dashboard error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PATCH /api/v1/appointments/:id/cancel
export const cancelMyAppointment = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');

    if (appointment.user_id !== userId) return errorResponse(res, 403, 'Access denied');

    if (appointment.status === 'cancelled') {
      return errorResponse(res, 409, 'Appointment is already cancelled');
    }
    if (appointment.status === 'completed') {
      return errorResponse(res, 409, 'Cannot cancel a completed appointment');
    }
    if (appointment.status === 'missed') {
      return errorResponse(res, 409, 'Cannot cancel a missed appointment');
    }
    if (appointment.payment_status === 'paid') {
      return errorResponse(res, 400, 'This appointment has already been paid. Please contact support to request a cancellation and refund.');
    }

    await updateAppointmentStatus(id, 'cancelled');

    return successResponse(res, 200, 'Appointment cancelled successfully', { id, status: 'cancelled' });
  } catch (err) {
    console.error('Cancel appointment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── Reviews ───────────────────────────────────────────────────────────────────

// POST /api/v1/appointments/:id/review
// User or dietitian. Submit a rating (1-5) + optional review text for a completed appointment.
// Body: { rating: 1-5, review?: string }
export const submitReview = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const role   = req.user!.role;
    const id     = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');

    if (appointment.status !== 'completed') {
      return errorResponse(res, 400, 'Reviews can only be submitted for completed appointments');
    }

    const { rating, review } = req.body as { rating?: number; review?: string };
    if (rating === undefined || rating === null) return errorResponse(res, 400, 'rating is required');
    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
      return errorResponse(res, 400, 'rating must be a number between 1 and 5');
    }

    if (role === 'dietitian') {
      const dietitian = await findDietitianByUserId(userId);
      if (!dietitian || dietitian.id !== appointment.dietitian_id)
        return errorResponse(res, 403, 'Access denied');
      if (appointment.dietitian_rating !== null)
        return errorResponse(res, 409, 'You have already submitted a review for this appointment');
      await saveDietitianReview(id, Number(rating), review?.trim() || null);
    } else {
      if (appointment.user_id !== userId) return errorResponse(res, 403, 'Access denied');
      if (appointment.user_rating !== null)
        return errorResponse(res, 409, 'You have already submitted a review for this appointment');
      await saveUserReview(id, Number(rating), review?.trim() || null);
    }

    const updated = await findAppointmentById(id);
    return successResponse(res, 201, 'Review submitted successfully', {
      user_review_done:      updated?.user_rating !== null,
      dietitian_review_done: updated?.dietitian_rating !== null,
    });
  } catch (err) {
    console.error('Submit review error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/:id/reviews
// User or dietitian. Fetch both reviews for an appointment.
export const getAppointmentReviews = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const role   = req.user!.role;
    const id     = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');

    if (role === 'dietitian') {
      const dietitian = await findDietitianByUserId(userId);
      if (!dietitian || dietitian.id !== appointment.dietitian_id)
        return errorResponse(res, 403, 'Access denied');
    } else {
      if (appointment.user_id !== userId) return errorResponse(res, 403, 'Access denied');
    }

    return successResponse(res, 200, 'Reviews fetched', {
      user_review_done:      appointment.user_rating !== null,
      dietitian_review_done: appointment.dietitian_rating !== null,
      reviews: {
        user: appointment.user_rating !== null ? {
          rating:      appointment.user_rating,
          review:      appointment.user_review,
          reviewed_at: appointment.user_reviewed_at,
        } : null,
        dietitian: appointment.dietitian_rating !== null ? {
          rating:      appointment.dietitian_rating,
          review:      appointment.dietitian_review,
          reviewed_at: appointment.dietitian_reviewed_at,
        } : null,
      },
    });
  } catch (err) {
    console.error('Get reviews error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/dietitian/reviews?page=1&limit=10&rating=5&search=...
// Dietitian only. Returns all user reviews across their appointments with summary stats.
export const getDietitianReviewsList = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const rating = req.query.rating ? Number(req.query.rating) : undefined;
    const search = req.query.search ? String(req.query.search).trim() : undefined;

    if (rating !== undefined && (isNaN(rating) || rating < 1 || rating > 5)) {
      return errorResponse(res, 400, 'rating filter must be between 1 and 5');
    }

    const { summary, reviews, total } = await getDietitianReviews(dietitian.id, rating, search, page, limit);

    return successResponse(
      res, 200, 'Reviews fetched',
      { summary, reviews },
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    );
  } catch (err) {
    console.error('Get dietitian reviews error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── Video call handlers ───────────────────────────────────────────────────────

const agoraConfigured = () =>
  Boolean(env.AGORA_APP_ID && env.AGORA_APP_CERTIFICATE && env.AGORA_CUSTOMER_ID && env.AGORA_CUSTOMER_SECRET);

// POST /api/v1/appointments/:id/join-call
// Authenticated: user or dietitian. Returns an Agora RTC token valid for 30 min.
// If the global setting `video_recording_enabled = '1'`, recording starts automatically
// on the very first join (no manual intervention required).
export const joinCall = async (req: Request, res: Response) => {
  try {
    if (!agoraConfigured()) return errorResponse(res, 503, 'Video calling is not configured');

    const userId = Number(req.user!.sub);
    const role   = req.user!.role;
    const id     = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');
    if (appointment.session_type !== 'video_call')
      return errorResponse(res, 400, 'This appointment is not a video call');
    if (appointment.status !== 'confirmed')
      return errorResponse(res, 400, 'Appointment must be confirmed before joining the call');
    if (appointment.video_call_status === 'ended')
      return errorResponse(res, 400, 'This call has already ended');

    // Verify the caller is the booked user or the dietitian for this appointment
    if (role === 'dietitian') {
      const dietitian = await findDietitianByUserId(userId);
      if (!dietitian || dietitian.id !== appointment.dietitian_id)
        return errorResponse(res, 403, 'Access denied');
    } else {
      if (appointment.user_id !== userId) return errorResponse(res, 403, 'Access denied');
    }

    // Generate a unique channel name on the very first join
    const isFirstJoin = !appointment.agora_channel_name;
    const channelName = appointment.agora_channel_name
      ?? `appt_${id}_${crypto.randomBytes(4).toString('hex')}`;

    // Persist channel + mark call as ongoing (COALESCE keeps original call_started_at on re-joins)
    await setAgoraChannel(id, channelName);

    // Track who joined (COALESCE preserves first-join timestamp on re-joins)
    if (role === 'dietitian') {
      await markDietitianJoined(id).catch(() => null);
    } else {
      await markUserJoined(id).catch(() => null);
    }

    // Auto-start recording on the first join if the setting is enabled
    if (isFirstJoin) {
      const recordingEnabled = await getSetting('video_recording_enabled');
      if (recordingEnabled === '1') {
        try {
          const recordingToken = generateRtcToken(channelName, AGORA_RECORDING_UID, CALL_MAX_SECONDS);
          const resourceId     = await agoraAcquire(channelName, AGORA_RECORDING_UID);
          const { sid }        = await agoraStartRecording(channelName, AGORA_RECORDING_UID, resourceId, recordingToken);
          await updateRecordingStarted(id, resourceId, sid, String(AGORA_RECORDING_UID));
        } catch (recErr) {
          // Recording failure must not block the caller from joining
          console.error('Auto-recording start failed for appointment', id, recErr);
        }
      }
    }

    // Use deterministic UIDs so both paths (join_url and joinCall meet_url) share the
    // same UID — user = appointmentId*2, dietitian = appointmentId*2+1.
    // This ensures trackUserJoin can reliably identify who joined regardless of entry point.
    const agoraUid  = role === 'dietitian' ? dietitianUid(id) : userUid(id);
    const expiresAt = Math.floor(Date.now() / 1000) + CALL_MAX_SECONDS;
    const token     = generateRtcToken(channelName, agoraUid, CALL_MAX_SECONDS);
    const meetUrl   = `${env.APP_BASE_URL}/meet/${id}?t=${generateMeetingToken(id, agoraUid)}`;

    return successResponse(res, 200, 'Joined call successfully', {
      channel_name:         channelName,
      token,
      uid:                  agoraUid,
      app_id:               env.AGORA_APP_ID,
      expires_at:           expiresAt,
      max_duration_seconds: CALL_MAX_SECONDS,
      meet_url:             meetUrl,
    });
  } catch (err) {
    console.error('Join call error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};


// POST /api/v1/appointments/:id/leave-call
// Authenticated: user or dietitian. Call this when the participant clicks "End Call".
// Immediately saves call_ended_at + call_duration_seconds so the user sees their time right away.
// recording_url is filled in later by the Agora webhook.
export const leaveCall = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const role   = req.user!.role;
    const id     = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');

    // Verify caller belongs to this appointment
    if (role === 'dietitian') {
      const dietitian = await findDietitianByUserId(userId);
      if (!dietitian || dietitian.id !== appointment.dietitian_id)
        return errorResponse(res, 403, 'Access denied');
    } else {
      if (appointment.user_id !== userId) return errorResponse(res, 403, 'Access denied');
    }

    if (appointment.video_call_status === 'not_started')
      return errorResponse(res, 400, 'Call has not started yet');

    // Record timing only — call stays 'ongoing' so either party can rejoin.
    // To permanently end the session, the dietitian must call POST /:id/end-call.
    await markCallLeft(id);

    // Re-fetch to return the latest duration to the client
    const updated = await findAppointmentById(id);

    return successResponse(res, 200, 'You have left the call. You can rejoin if needed.', {
      status:                updated?.status,
      video_call_status:     updated?.video_call_status,
      call_started_at:       updated?.call_started_at,
      call_ended_at:         updated?.call_ended_at,
      call_duration_seconds: updated?.call_duration_seconds,
      can_rejoin:            updated?.video_call_status === 'ongoing',
    });
  } catch (err) {
    console.error('Leave call error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/:id/recording
// Authenticated: user or dietitian. Returns recording URL and call duration.
export const getCallRecording = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const role   = req.user!.role;
    const id     = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');

    if (role === 'dietitian') {
      const dietitian = await findDietitianByUserId(userId);
      if (!dietitian || dietitian.id !== appointment.dietitian_id)
        return errorResponse(res, 403, 'Access denied');
    } else {
      if (appointment.user_id !== userId) return errorResponse(res, 403, 'Access denied');
    }

    return successResponse(res, 200, 'Recording info fetched', {
      video_call_status:    appointment.video_call_status,
      recording_url:        appointment.recording_url,
      call_started_at:      appointment.call_started_at,
      call_ended_at:        appointment.call_ended_at,
      call_duration_seconds: appointment.call_duration_seconds,
    });
  } catch (err) {
    console.error('Get recording error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── Reschedule slots ──────────────────────────────────────────────────────────

// GET /api/v1/appointments/:id/reschedule-slots?days=30
// Dietitian only. Returns the dietitian's available slots for rescheduling a specific appointment.
// The current appointment's own slot is excluded from the booked set so it appears as selectable.
// Also returns the appointment's current date/slot so the frontend can highlight it.
export const getRescheduleSlots = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');
    if (appointment.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    if (!['confirmed', 'missed'].includes(appointment.status)) {
      return errorResponse(res, 400, 'Only confirmed or missed appointments can be rescheduled');
    }

    const rescheduleCount = await countRescheduleHistory(id);
    if (rescheduleCount >= 1) {
      return errorResponse(res, 400, 'This appointment has already been rescheduled once and cannot be rescheduled again');
    }

    const days = Math.min(Number(req.query.days) || 30, 60);

    const schedule = typeof dietitian.availability === 'string'
      ? JSON.parse(dietitian.availability)
      : (dietitian.availability ?? null);

    const availableDates = buildAvailableDates(schedule, days);
    if (availableDates.length === 0) {
      return successResponse(res, 200, 'No available slots', {
        current: { date: appointment.appointment_date, slot: appointment.slot },
        available_slots: [],
      });
    }

    const fromDate = availableDates[0].date;
    const booked = await getBookedSlots(dietitian.id, fromDate);

    // Exclude the current appointment's own slot so it shows as selectable
    const bookedSet = new Set(
      booked
        .filter((b) => !(b.appointment_date === appointment.appointment_date && b.slot === appointment.slot))
        .map((b) => `${b.appointment_date}|${b.slot}`),
    );

    // Group booked slots by date
    const bookedByDate = new Map<string, string[]>();
    for (const b of booked) {
      if (b.appointment_date === appointment.appointment_date && b.slot === appointment.slot) continue;
      if (!bookedByDate.has(b.appointment_date)) bookedByDate.set(b.appointment_date, []);
      bookedByDate.get(b.appointment_date)!.push(b.slot);
    }

    const available_slots = availableDates
      .map((d) => ({
        date: d.date,
        day: d.day,
        slots: d.slots.filter((s) => !bookedSet.has(`${d.date}|${s}`)),
      }))
      .filter((d) => d.slots.length > 0);

    const booked_slots = [...bookedByDate.entries()]
      .map(([date, slots]) => {
        const entry = availableDates.find((d) => d.date === date);
        return { date, day: entry?.day ?? '', slots };
      })
      .filter((d) => d.slots.length > 0);

    return successResponse(res, 200, 'Reschedule slots fetched', {
      current: {
        date: appointment.appointment_date,
        slot: appointment.slot,
      },
      available_slots,
      booked_slots,
    });
  } catch (err) {
    console.error('Get reschedule slots error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/:id/follow-up-slots?days=30
// Dietitian-only. Returns available slots for scheduling a follow-up call.
// Works for confirmed and completed appointments (no status restriction).
export const getFollowUpSlots = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');
    if (appointment.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    if (!['confirmed', 'completed'].includes(appointment.status)) {
      return errorResponse(res, 400, 'Follow-up can only be scheduled for confirmed or completed appointments');
    }

    const days = Math.min(Number(req.query.days) || 30, 60);

    const schedule = typeof dietitian.availability === 'string'
      ? JSON.parse(dietitian.availability)
      : (dietitian.availability ?? null);

    const availableDates = buildAvailableDates(schedule, days);
    if (availableDates.length === 0) {
      return successResponse(res, 200, 'No available slots', { available_slots: [] });
    }

    const fromDate = availableDates[0].date;
    const booked = await getBookedSlots(dietitian.id, fromDate);
    const bookedSet = new Set(booked.map((b) => `${b.appointment_date}|${b.slot}`));

    const bookedByDate = new Map<string, string[]>();
    for (const b of booked) {
      if (!bookedByDate.has(b.appointment_date)) bookedByDate.set(b.appointment_date, []);
      bookedByDate.get(b.appointment_date)!.push(b.slot);
    }

    const available_slots = availableDates
      .map((d) => ({
        date: d.date,
        day: d.day,
        slots: d.slots.filter((s) => !bookedSet.has(`${d.date}|${s}`)),
      }))
      .filter((d) => d.slots.length > 0);

    const booked_slots = [...bookedByDate.entries()]
      .map(([date, slots]) => {
        const entry = availableDates.find((d) => d.date === date);
        return { date, day: entry?.day ?? '', slots };
      })
      .filter((d) => d.slots.length > 0);

    return successResponse(res, 200, 'Follow-up slots fetched', { available_slots, booked_slots });
  } catch (err) {
    console.error('Get follow-up slots error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── Mark missed ───────────────────────────────────────────────────────────────

const VALID_MISSED_TYPES: MissedType[] = [
  'patient_no_show',
  'dietitian_no_show',
  'technical_issue',
  'network_issue',
  'other',
];

// PATCH /api/v1/appointments/:id/mark-missed
// Dietitian only. Explicitly mark a confirmed appointment as missed with a reason type.
// Body: { missed_type, missed_reason? }
export const markMissedHandler = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');
    if (appointment.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    if (!['confirmed', 'missed'].includes(appointment.status)) {
      return errorResponse(res, 400, 'Only confirmed or missed appointments can be marked missed');
    }

    const { missed_type, missed_reason } = req.body as {
      missed_type?: string;
      missed_reason?: string;
    };

    if (!missed_type) return errorResponse(res, 400, 'missed_type is required');
    if (!VALID_MISSED_TYPES.includes(missed_type as MissedType)) {
      return errorResponse(
        res, 400,
        `missed_type must be one of: ${VALID_MISSED_TYPES.join(', ')}`,
      );
    }

    await markAppointmentMissedWithType(
      id,
      missed_type as MissedType,
      missed_reason?.trim() || null,
    );

    const updated = await findAppointmentById(id);

    return successResponse(res, 200, 'Appointment marked as missed', updated);
  } catch (err) {
    console.error('Mark missed error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── Reschedule ────────────────────────────────────────────────────────────────

// PATCH /api/v1/appointments/:id/reschedule
// Dietitian only. Move a missed or confirmed appointment to a new date/slot and restore to confirmed.
// Body: { appointment_date, slot }
export const rescheduleAppointmentHandler = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');
    if (appointment.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    if (!['missed', 'confirmed'].includes(appointment.status)) {
      return errorResponse(res, 400, 'Only missed or confirmed appointments can be rescheduled');
    }

    const rescheduleCount = await countRescheduleHistory(id);
    if (rescheduleCount >= 1) {
      return errorResponse(res, 400, 'This appointment has already been rescheduled once and cannot be rescheduled again');
    }

    const { appointment_date, slot, reason } = req.body as {
      appointment_date?: string;
      slot?: string;
      reason?: string;
    };

    if (!appointment_date) return errorResponse(res, 400, 'appointment_date is required');
    if (!slot) return errorResponse(res, 400, 'slot is required');

    if (!/^\d{2}:\d{2}$/.test(slot)) {
      return errorResponse(res, 400, 'slot must be in HH:MM format (e.g. "09:30")');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment_date)) {
      return errorResponse(res, 400, 'appointment_date must be in YYYY-MM-DD format');
    }

    const [yr, mo, dy] = appointment_date.split('-').map(Number);
    const requestedDate = new Date(yr, mo - 1, dy);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      return errorResponse(res, 400, 'appointment_date cannot be in the past');
    }

    // Check slot availability, excluding the current appointment from the conflict check
    const taken = await isSlotTaken(dietitian.id, appointment_date, slot, id);
    if (taken) {
      return errorResponse(res, 409, 'This slot is already booked. Please choose another.');
    }

    await createRescheduleHistory({
      appointment_id: id,
      rescheduled_by: userId,
      previous_date: appointment.appointment_date,
      previous_slot: appointment.slot,
      new_date: appointment_date,
      new_slot: slot,
      reason: reason?.trim() || null,
    });

    await rescheduleAppointment(id, appointment_date, slot, reason?.trim() || null);

    const updated = await findAppointmentById(id);

    // Fire reschedule notifications in background
    setImmediate(async () => {
      try {
        const fullDietitian = await findDietitianById(dietitian.id);
        const dietitianName = fullDietitian?.full_name ?? 'Your Dietitian';

        const isVideoCall = appointment.session_type === 'video_call';
        const baseUrl = env.APP_BASE_URL ?? 'http://localhost:3000';
        const userJoinUrl = isVideoCall
          ? `${baseUrl}/meet/${id}?t=${generateMeetingToken(id, userUid(id))}`
          : undefined;

        // Email to user
        if (appointment.email) {
          const userMail = appointmentRescheduledUserEmail({
            userName: appointment.name,
            dietitianName,
            previousDate: appointment.appointment_date,
            previousSlot: appointment.slot,
            newDate: appointment_date,
            newSlot: slot,
            sessionType: appointment.session_type,
            reason: reason?.trim() || null,
            joinUrl: userJoinUrl,
          });
          await sendEmail({ to: appointment.email, subject: userMail.subject, html: userMail.html, text: userMail.text })
            .catch((e) => console.error('[reschedule] User email failed:', e));
        }

        // Email to dietitian
        if (fullDietitian?.email) {
          const dietMail = appointmentRescheduledDietitianEmail({
            dietitianName,
            patientName: appointment.name,
            previousDate: appointment.appointment_date,
            previousSlot: appointment.slot,
            newDate: appointment_date,
            newSlot: slot,
            sessionType: appointment.session_type,
          });
          await sendEmail({ to: fullDietitian.email, subject: dietMail.subject, html: dietMail.html, text: dietMail.text })
            .catch((e) => console.error('[reschedule] Dietitian email failed:', e));
        }

        // WhatsApp to user
        if (appointment.phone) {
          await sendAppointmentRescheduledWhatsApp(
            appointment.phone,
            appointment.name,
            appointment.appointment_date,
            appointment.slot,
            appointment_date,
            slot,
            userJoinUrl,
          ).catch((e) => console.error('[reschedule] User WhatsApp failed:', e));
        }

        // WhatsApp to dietitian
        if (fullDietitian?.phone_number) {
          const dietitianPhone = fullDietitian.phone_code
            ? `${fullDietitian.phone_code}${fullDietitian.phone_number}`
            : fullDietitian.phone_number;
          await sendDietitianRescheduledWhatsApp(
            dietitianPhone,
            dietitianName,
            appointment.name,
            appointment.appointment_date,
            appointment.slot,
            appointment_date,
            slot,
          ).catch((e) => console.error('[reschedule] Dietitian WhatsApp failed:', e));
        }
      } catch (e) {
        console.error('[reschedule] Post-reschedule notification error:', e);
      }
    });

    return successResponse(res, 200, 'Appointment rescheduled successfully', updated);
  } catch (err) {
    console.error('Reschedule appointment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/:id/reschedule-history
// Dietitian or admin — full log of every reschedule for this appointment.
export const getAppointmentRescheduleHistory = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const role = req.user!.role;
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');

    // Dietitian must own the appointment; admin has unrestricted access
    if (role === 'dietitian') {
      const dietitian = await findDietitianByUserId(userId);
      if (!dietitian || dietitian.id !== appointment.dietitian_id)
        return errorResponse(res, 403, 'Access denied');
    } else if (role !== 'admin') {
      return errorResponse(res, 403, 'Access denied');
    }

    const history = await getRescheduleHistory(id);

    return successResponse(res, 200, 'Reschedule history fetched', history);
  } catch (err) {
    console.error('Get reschedule history error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── Dietitian notes ───────────────────────────────────────────────────────────

// PUT /api/v1/appointments/:id/dietitian-notes
export const saveDietitianNotes = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const { notes } = req.body as { notes?: string };
    if (notes === undefined) return errorResponse(res, 400, 'notes is required');

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');
    if (appointment.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    await updateDietitianNotes(id, notes.trim() || null);

    return successResponse(res, 200, 'Notes saved');
  } catch (err) {
    console.error('Save dietitian notes error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/:id/dietitian-notes
export const getDietitianNotes = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');
    if (appointment.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    return successResponse(res, 200, 'Notes fetched', { notes: appointment.dietitian_notes ?? null });
  } catch (err) {
    console.error('Get dietitian notes error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/:id/diet-form
// Dietitian-only. Returns the diet form filled for the patient linked to this appointment.
export const getAppointmentDietForm = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const id     = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');
    if (appointment.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    const form = await findDietFormByAppointmentId(id);
    if (!form) return errorResponse(res, 404, 'No diet form found for this appointment');

    return successResponse(res, 200, 'Diet form fetched successfully', form);
  } catch (err) {
    console.error('Get appointment diet form error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── Follow-up appointments ────────────────────────────────────────────────────

// POST /api/v1/appointments/:id/follow-up
// Dietitian-only. Schedule a follow-up call during or after an active/completed appointment.
// Body: { appointment_date, slot, duration?, fee?, session_type?, notes? }
// The follow-up is auto-confirmed (no payment flow); payment can be collected separately.
export const scheduleFollowUp = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const parentId = Number(req.params.id);
    if (isNaN(parentId)) return errorResponse(res, 400, 'Invalid appointment ID');

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const parent = await findAppointmentById(parentId);
    if (!parent) return errorResponse(res, 404, 'Appointment not found');
    if (parent.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    if (!['confirmed', 'completed'].includes(parent.status)) {
      return errorResponse(res, 400, 'Follow-up can only be scheduled for confirmed or completed appointments');
    }

    const {
      appointment_date,
      slot,
      duration,
      session_type,
      follow_up_type,
      notes,
    } = req.body as {
      appointment_date?: string;
      slot?: string;
      duration?: number;
      session_type?: 'video_call' | 'in_person';
      follow_up_type?: string;
      notes?: string;
    };

    if (!appointment_date) return errorResponse(res, 400, 'appointment_date is required');
    if (!slot) return errorResponse(res, 400, 'slot is required');

    if (!/^\d{2}:\d{2}$/.test(slot)) {
      return errorResponse(res, 400, 'slot must be in HH:MM format (e.g. "09:30")');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment_date)) {
      return errorResponse(res, 400, 'appointment_date must be in YYYY-MM-DD format');
    }

    const [yr, mo, dy] = appointment_date.split('-').map(Number);
    const requestedDate = new Date(yr, mo - 1, dy);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      return errorResponse(res, 400, 'appointment_date cannot be in the past');
    }

    const taken = await isSlotTaken(dietitian.id, appointment_date, slot);
    if (taken) {
      return errorResponse(res, 409, 'This slot is already booked. Please choose another.');
    }

    const followUp = await createAppointment({
      dietitian_id: dietitian.id,
      user_id: parent.user_id,
      name: parent.name,
      email: parent.email,
      phone: parent.phone,
      appointment_date,
      slot,
      duration: duration ?? parent.duration,
      session_type: session_type ?? parent.session_type,
      fee: 0,
      currency: parent.currency,
      notes: notes ?? null,
      parent_appointment_id: parentId,
      is_follow_up: true,
      follow_up_type: follow_up_type?.trim() || null,
    });

    if (!followUp) return errorResponse(res, 500, 'Failed to create follow-up appointment');

    // Auto-confirm and mark payment approved (follow-ups are complimentary — no payment flow)
    await updateAppointmentStatus(followUp.id, 'confirmed');
    await markPaymentApproved(followUp.id, null);

    const confirmed = await findAppointmentById(followUp.id);

    // Notify user about the follow-up
    setImmediate(async () => {
      try {
        const fullDietitian = await findDietitianById(dietitian.id);
        const dietitianName = fullDietitian?.full_name ?? 'Your Dietitian';
        const followUpSessionType = session_type ?? parent.session_type;
        const isVideoCall = followUpSessionType === 'video_call';
        const baseUrl = env.APP_BASE_URL ?? 'http://localhost:3000';
        const userJoinUrl = isVideoCall && followUp
          ? `${baseUrl}/meet/${followUp.id}?t=${generateMeetingToken(followUp.id, userUid(followUp.id))}`
          : undefined;

        if (parent.email) {
          const mail = followUpScheduledEmail({
            userName: parent.name,
            dietitianName,
            appointmentDate: appointment_date,
            slot,
            sessionType: followUpSessionType,
            joinUrl: userJoinUrl,
          });
          await sendEmail({ to: parent.email, subject: mail.subject, html: mail.html, text: mail.text })
            .catch((e) => console.error('[follow-up] User email failed:', e));
        }

        if (parent.phone) {
          await sendFollowUpScheduledWhatsApp(
            parent.phone,
            parent.name,
            appointment_date,
            slot,
            userJoinUrl,
          ).catch((e) => console.error('[follow-up] User WhatsApp failed:', e));
        }
      } catch (e) {
        console.error('[follow-up] Notification error:', e);
      }
    });

    return successResponse(res, 201, 'Follow-up appointment scheduled successfully', confirmed);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      return errorResponse(res, 409, 'This slot is already booked. Please choose another.');
    }
    console.error('Schedule follow-up error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/follow-ups?tab=all&search=&page=1&limit=20
// Dietitian only. Returns all follow-up appointments across all clients with summary stats.
export const getFollowUpsList = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const VALID_TABS: FollowUpListTab[] = ['all', 'due_today', 'upcoming', 'completed', 'missed'];
    const tab = VALID_TABS.includes(req.query.tab as FollowUpListTab)
      ? (req.query.tab as FollowUpListTab)
      : 'all';
    const search = typeof req.query.search === 'string' && req.query.search.trim()
      ? req.query.search.trim() : undefined;
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const [summary, { rows, total }] = await Promise.all([
      getFollowUpListSummary(dietitian.id),
      listFollowUpAppointments(dietitian.id, tab, search, page, limit),
    ]);

    return successResponse(
      res, 200, 'Follow-ups fetched',
      { summary, follow_ups: rows },
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    );
  } catch (err) {
    console.error('Get follow-ups list error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/appointments/:id/follow-ups
// Authenticated: dietitian or the patient of the original appointment.
export const getAppointmentFollowUps = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.sub);
    const role = req.user!.role;
    const parentId = Number(req.params.id);
    if (isNaN(parentId)) return errorResponse(res, 400, 'Invalid appointment ID');

    const parent = await findAppointmentById(parentId);
    if (!parent) return errorResponse(res, 404, 'Appointment not found');

    if (role === 'dietitian') {
      const dietitian = await findDietitianByUserId(userId);
      if (!dietitian || dietitian.id !== parent.dietitian_id)
        return errorResponse(res, 403, 'Access denied');
    } else {
      if (parent.user_id !== userId) return errorResponse(res, 403, 'Access denied');
    }

    const followUps = await findFollowUpsByAppointmentId(parentId);

    // Never expose dietitian_notes to the patient
    const data = role === 'dietitian'
      ? followUps
      : followUps.map(({ dietitian_notes: _dn, ...rest }) => rest);

    return successResponse(res, 200, 'Follow-up appointments fetched', data);
  } catch (err) {
    console.error('Get follow-ups error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── Agora webhook ─────────────────────────────────────────────────────────────

// Agora Cloud Recording event types (productId = 4)
const AGORA_EVENT_RECORDER_LEAVE = 41; // recorder left channel — call is over
const AGORA_EVENT_FILE_INFOS     =  4; // recording files uploaded to storage — URL is ready

interface AgoraWebhookBody {
  noticeId: string;
  productId: number;
  eventType: number;
  details?: {
    msgName?: string;
    cname?: string;
    sid?: string;
    details?: {
      fileList?: Array<{ filename: string; isPlayable: boolean; trackType: string }>;
    };
  };
}

// POST /webhooks/agora  (no auth — called by Agora's notification service)
//
// Two events we care about:
//   32 — recorder_leave  → call ended; save duration (video_call_status → ended). Status NOT changed here.
//   31 — file_infos      → recording uploaded to S3; save recording URL
//
// Appointment status is set to 'completed' only by the dietitian via PATCH /:id/status.
// Agora fires 32 first (almost immediately when idle), then 31 after the upload finishes.
export const agoraWebhook = async (req: Request, res: Response) => {
  try {
    const body = req.body as AgoraWebhookBody;

    console.log('[Agora Webhook] received:', JSON.stringify({ productId: body.productId, eventType: body.eventType, cname: body.details?.cname }));

    // Only care about Cloud Recording events (productId 4)
    if (body.productId !== 4) return res.status(200).json({ success: true });

    const channelName = body.details?.cname;
    if (!channelName) return res.status(200).json({ success: true });

    const appointment = await findAppointmentByChannelName(channelName);
    if (!appointment) return res.status(200).json({ success: true });

    if (body.eventType === AGORA_EVENT_RECORDER_LEAVE) {
      // Recorder left → save call duration. Status stays as-is; dietitian marks completed via API.
      if (appointment.video_call_status !== 'ended') {
        await updateCallEnded(appointment.id, null);
      }
    } else if (body.eventType === AGORA_EVENT_FILE_INFOS) {
      // Recording file(s) are now in S3. Build the URL and store it.
      const fileList = body.details?.details?.fileList;
      if (fileList?.length) {
        const mp4 = fileList.find((f) => f.filename.endsWith('.mp4')) ?? fileList[0];
        const recordingUrl = `${env.AWS_S3_BASE_URL}/${mp4.filename}`;

        if (appointment.video_call_status !== 'ended') {
          // Rare: file_infos arrived before recorder_leave — handle both in one shot
          await updateCallEnded(appointment.id, recordingUrl);
        } else {
          // Normal path: recorder_leave already ran, just fill in the URL
          await updateRecordingUrl(appointment.id, recordingUrl);
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Agora webhook error:', err);
    return res.status(200).json({ success: true }); // always 200 so Agora does not retry
  }
};

// POST /api/v1/appointments/:id/track-join
// Called by the meet page JS after Agora join succeeds.
// Authenticated by the meeting JWT (no login token needed — user came from a notification link).
export const trackUserJoin = async (req: Request, res: Response): Promise<void> => {
  try {
    const appointmentId = Number(req.params.id);
    const { t } = req.body as { t?: string };

    if (!t) { res.status(400).json({ success: false }); return; }

    const payload = verifyMeetingToken(t);
    if (!payload || payload.appointmentId !== appointmentId) {
      res.status(401).json({ success: false }); return;
    }

    const appointment = await findAppointmentById(appointmentId);
    if (!appointment) { res.status(404).json({ success: false }); return; }

    // UID is always deterministic: user = appointmentId*2, dietitian = appointmentId*2+1
    // This works for both entry points: join_url (getMyAppointments) and joinCall meet_url
    if (payload.uid === userUid(appointmentId)) {
      await markUserJoined(appointmentId);
    } else {
      await markDietitianJoined(appointmentId);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Track join error:', err);
    res.status(500).json({ success: false });
  }
};
