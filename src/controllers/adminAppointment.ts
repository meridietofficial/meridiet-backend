import type { Request, Response } from 'express';
import {
  adminListAppointments,
  adminGetAppointmentDetail,
  findAppointmentById,
  markPaymentApproved,
  markAppointmentMissedWithType,
  markAppointmentPaymentRefunded,
  adminGetPendingApprovals,
  adminGetPendingNoShowApprovals,
  adminGetPaymentHistory,
  adminGetNoShowQueue,
  type MissedType,
} from '../models/Appointment';
import { getRescheduleHistory } from '../models/AppointmentRescheduleHistory';
import {
  creditDietitianForAppointment,
  creditDietitianForNoShow,
  debitDietitianForNoShowPenalty,
  NO_SHOW_PENALTY,
} from '../models/DietitianWallet';
import { findDietitianById } from '../models/Dietitian';
import { getSetting } from '../models/Setting';
import { successResponse, errorResponse } from '../utils/response';
import { sendEmail } from '../services/email';
import { appointmentPaymentApprovedEmail } from '../services/emails/appointmentPaymentApproved';
import { noShowPenaltyEmail } from '../services/emails/noShowPenaltyEmail';
import { razorpay } from '../config/razorpay';

// GET /api/v1/admin/appointments/pending-approval
// Returns completed + paid appointments waiting for admin payment approval.
// Query params: page, limit, search
export const adminGetPendingApprovalsList = async (req: Request, res: Response) => {
  try {
    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = typeof req.query.search === 'string' && req.query.search.trim()
      ? req.query.search.trim() : undefined;

    const [result, commPctRaw] = await Promise.all([
      adminGetPendingApprovals(page, limit, search),
      getSetting('platform_commission_pct'),
    ]);
    const commission_pct = commPctRaw !== null ? Number(commPctRaw) : 20;

    return successResponse(res, 200, 'Pending approvals fetched', {
      commission_pct,
      appointments: result.appointments,
      pagination: {
        total: result.total,
        page:  result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    console.error('Admin pending approvals error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/appointments/payment-history
// Returns appointments whose payment has been approved, with full breakdown.
// Query params: page, limit, search, dietitian_id, date_from, date_to
export const adminGetPaymentHistoryList = async (req: Request, res: Response) => {
  try {
    const page          = Math.max(1, Number(req.query.page) || 1);
    const limit         = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search        = typeof req.query.search === 'string' && req.query.search.trim()
      ? req.query.search.trim() : undefined;
    const dietitian_id  = req.query.dietitian_id ? Number(req.query.dietitian_id) : undefined;
    const date_from     = typeof req.query.date_from === 'string' ? req.query.date_from : undefined;
    const date_to       = typeof req.query.date_to   === 'string' ? req.query.date_to   : undefined;

    if (date_from && !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
      return errorResponse(res, 400, 'date_from must be YYYY-MM-DD');
    }
    if (date_to && !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
      return errorResponse(res, 400, 'date_to must be YYYY-MM-DD');
    }

    const result = await adminGetPaymentHistory(page, limit, search, dietitian_id, date_from, date_to);

    return successResponse(res, 200, 'Payment history fetched', {
      appointments: result.appointments,
      pagination: {
        total: result.total,
        page:  result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    console.error('Admin payment history error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/appointments
// Query params: page, limit, status, payment_status, session_type, dietitian_id, date_from, date_to, search
export const adminGetAppointments = async (req: Request, res: Response) => {
  try {
    const {
      page,
      limit,
      status,
      payment_status,
      session_type,
      dietitian_id,
      date_from,
      date_to,
      search,
      no_show,
    } = req.query as Record<string, string | undefined>;

    const validStatuses  = ['pending', 'confirmed', 'completed', 'cancelled', 'missed'];
    const validPayments  = ['unpaid', 'paid', 'refunded'];
    const validSessions  = ['video_call', 'in_person'];
    const validNoShow    = ['user', 'dietitian', 'any'];

    if (status && !validStatuses.includes(status)) {
      return errorResponse(res, 400, `status must be one of: ${validStatuses.join(', ')}`);
    }
    if (payment_status && !validPayments.includes(payment_status)) {
      return errorResponse(res, 400, `payment_status must be one of: ${validPayments.join(', ')}`);
    }
    if (session_type && !validSessions.includes(session_type)) {
      return errorResponse(res, 400, `session_type must be one of: ${validSessions.join(', ')}`);
    }
    if (date_from && !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
      return errorResponse(res, 400, 'date_from must be YYYY-MM-DD');
    }
    if (date_to && !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
      return errorResponse(res, 400, 'date_to must be YYYY-MM-DD');
    }
    if (no_show && !validNoShow.includes(no_show)) {
      return errorResponse(res, 400, `no_show must be one of: ${validNoShow.join(', ')}`);
    }

    const result = await adminListAppointments({
      page:           page   ? Number(page)  : 1,
      limit:          limit  ? Number(limit) : 20,
      status,
      payment_status,
      session_type,
      dietitian_id:   dietitian_id ? Number(dietitian_id) : undefined,
      date_from,
      date_to,
      search:         search?.trim() || undefined,
      no_show:        no_show as 'user' | 'dietitian' | 'any' | undefined,
    });

    return successResponse(res, 200, 'Appointments fetched', {
      appointments: result.appointments,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    console.error('Admin get appointments error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/appointments/:id/approve-payment
// Admin reviews the completed appointment and credits the dietitian.
// Stores the admin/staff user ID who approved for full audit trail.
// For patient no-shows (missed_type = 'patient_no_show'), the dietitian receives
// 50% of the net fee (after commission). For normal completions, full net fee.
export const adminApprovePayment = async (req: Request, res: Response) => {
  try {
    const adminUserId = Number(req.user!.sub);
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');

    if (appointment.status !== 'completed') {
      return errorResponse(res, 400, 'Only completed appointments can have their payment approved');
    }
    if (appointment.payment_status !== 'paid') {
      return errorResponse(res, 400, 'Appointment payment was not collected — nothing to credit');
    }
    if (appointment.payment_approved_at) {
      return errorResponse(res, 409, 'Payment has already been approved for this appointment');
    }

    // Use final_amount (post-coupon) if payment was discounted, else original fee
    const chargeableAmount = appointment.final_amount ?? appointment.fee;
    const result = await creditDietitianForAppointment(appointment.dietitian_id, id, chargeableAmount, adminUserId);

    if (!result.credited) {
      if (result.reason === 'already_credited') {
        return errorResponse(res, 409, 'Dietitian has already been credited for this appointment');
      }
      if (result.reason === 'dietitian_not_found') {
        return errorResponse(res, 404, 'Dietitian not found');
      }
      return errorResponse(res, 400, 'Payment could not be processed');
    }

    await markPaymentApproved(id, adminUserId);

    setImmediate(async () => {
      try {
        const dietitian = await findDietitianById(appointment.dietitian_id);
        if (dietitian?.email && result.details) {
          const mail = appointmentPaymentApprovedEmail({
            dietitianName:   dietitian.full_name ?? 'Dietitian',
            patientName:     appointment.name,
            appointmentDate: appointment.appointment_date,
            slot:            appointment.slot,
            grossAmount:     result.details.grossAmount,
            commission:      result.details.commission,
            netAmount:       result.details.netAmount,
            commPct:         result.details.commPct,
            currency:        appointment.currency,
            isNoShow:        false,
          });
          await sendEmail({
            to:      dietitian.email,
            subject: mail.subject,
            html:    mail.html,
            text:    mail.text,
          }).catch((e) => console.error('[approve-payment] Dietitian email failed:', e));
        }
      } catch (e) {
        console.error('[approve-payment] Notification error:', e);
      }
    });

    return successResponse(res, 200, 'Payment approved and credited to dietitian wallet', {
      appointment_id:  id,
      approved_by:     adminUserId,
      gross_amount:    result.details?.grossAmount,
      commission_pct:  result.details?.commPct,
      commission:      result.details?.commission,
      amount_credited: result.details?.netAmount,
      transaction_id:  result.transaction.id,
    });
  } catch (err) {
    console.error('Admin approve payment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/appointments/:id
export const adminGetAppointmentById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const [appointment, rescheduleHistory] = await Promise.all([
      adminGetAppointmentDetail(id),
      getRescheduleHistory(id),
    ]);

    if (!appointment) return errorResponse(res, 404, 'Appointment not found');

    return successResponse(res, 200, 'Appointment fetched', {
      ...appointment,
      reschedule_history: rescheduleHistory,
    });
  } catch (err) {
    console.error('Admin get appointment detail error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/appointments/no-show-queue
// Past confirmed+paid appointments where one or both parties didn't join.
// Admin reviews this list to call parties and decide next action.
export const adminGetNoShowQueueHandler = async (req: Request, res: Response) => {
  try {
    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = typeof req.query.search === 'string' && req.query.search.trim()
      ? req.query.search.trim() : undefined;

    const result = await adminGetNoShowQueue(page, limit, search);

    return successResponse(res, 200, 'No-show queue fetched', {
      appointments: result.appointments,
      pagination: {
        total: result.total,
        page:  result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    console.error('Admin no-show queue error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/appointments/pending-no-show-approval
// Missed appointments where admin has marked the type but not yet approved the financial action.
export const adminGetPendingNoShowApprovalsHandler = async (req: Request, res: Response) => {
  try {
    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = typeof req.query.search === 'string' && req.query.search.trim()
      ? req.query.search.trim() : undefined;

    const [result, commPctRaw] = await Promise.all([
      adminGetPendingNoShowApprovals(page, limit, search),
      getSetting('platform_commission_pct'),
    ]);
    const commission_pct = commPctRaw !== null ? Number(commPctRaw) : 20;

    return successResponse(res, 200, 'Pending no-show approvals fetched', {
      commission_pct,
      penalty_amount: NO_SHOW_PENALTY,
      appointments: result.appointments,
      pagination: {
        total: result.total,
        page:  result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    console.error('Admin pending no-show approvals error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/appointments/:id/mark-no-show  ── STEP 1
// Admin records who didn't show and optionally adds a reason.
// No money moves here. Appointment goes into pending-no-show-approval queue.
// Body: { missed_type, missed_reason? }
export const adminMarkNoShow = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const { missed_type, missed_reason } = req.body as {
      missed_type?: string;
      missed_reason?: string;
    };

    const validTypes: MissedType[] = ['patient_no_show', 'dietitian_no_show', 'both_no_show', 'technical_issue', 'network_issue', 'other'];
    if (!missed_type) return errorResponse(res, 400, 'missed_type is required');
    if (!validTypes.includes(missed_type as MissedType)) {
      return errorResponse(res, 400, `missed_type must be one of: ${validTypes.join(', ')}`);
    }

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');

    if (!['confirmed', 'missed'].includes(appointment.status)) {
      return errorResponse(res, 400, 'Only confirmed appointments can be marked as no-show');
    }
    if (appointment.payment_status === 'refunded') {
      return errorResponse(res, 409, 'This appointment has already been refunded');
    }
    if (appointment.payment_approved_at) {
      return errorResponse(res, 409, 'Financial action has already been approved for this appointment');
    }

    await markAppointmentMissedWithType(id, missed_type as MissedType, missed_reason?.trim() || null);

    const type = missed_type as MissedType;
    const pendingAction =
      type === 'patient_no_show'   ? 'Dietitian will be credited 50% of net fee upon approval' :
      type === 'dietitian_no_show' ? 'Patient will be refunded + ₹100 penalty on dietitian upon approval' :
      type === 'both_no_show'      ? '₹100 penalty on dietitian upon approval, no refund to patient' :
                                     'No financial action — approve to close, or re-classify with a financial type first';

    return successResponse(res, 200, 'Appointment marked as no-show — pending financial approval', {
      appointment_id:  id,
      missed_type:     type,
      missed_reason:   missed_reason?.trim() || null,
      pending_action:  pendingAction,
    });
  } catch (err) {
    console.error('Admin mark no-show error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/appointments/:id/approve-no-show  ── STEP 2
// Admin reviews and confirms the financial action for a no-show appointment.
// This is where money actually moves.
//
// patient_no_show   → dietitian credited 50% of (fee − commission)
// dietitian_no_show → full Razorpay refund to patient + ₹100 penalty from dietitian wallet
// both_no_show      → ₹100 penalty from dietitian wallet, no refund
export const adminApproveNoShow = async (req: Request, res: Response) => {
  try {
    const adminUserId = Number(req.user!.sub);
    const id          = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const appointment = await findAppointmentById(id);
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');

    if (appointment.status !== 'missed') {
      return errorResponse(res, 400, 'Only missed appointments can be approved here');
    }
    if (!appointment.missed_type) {
      return errorResponse(res, 400, 'Appointment has no missed_type set — mark it first using mark-no-show');
    }
    if (appointment.payment_approved_at) {
      return errorResponse(res, 409, 'Financial action has already been approved for this appointment');
    }

    // Technical/network/other missed types come from the dietitian's mark-missed endpoint.
    // No automatic financial action — admin closes these with no money movement.
    // To take financial action instead, re-classify via mark-no-show first.
    const technicalTypes = ['technical_issue', 'network_issue', 'other'];
    if (technicalTypes.includes(appointment.missed_type)) {
      await markPaymentApproved(id, adminUserId);
      return successResponse(res, 200, 'Appointment closed — no financial action taken for technical/other missed type', {
        appointment_id: id,
        missed_type:    appointment.missed_type,
        action:         'closed_no_financial_action',
        note:           'To take financial action, re-classify with mark-no-show first',
      });
    }

    const type = appointment.missed_type as 'patient_no_show' | 'dietitian_no_show' | 'both_no_show';

    // ── Patient no-show → credit dietitian 50% ────────────────────────────────
    if (type === 'patient_no_show') {
      if (appointment.payment_status !== 'paid') {
        await markPaymentApproved(id, adminUserId);
        return successResponse(res, 200, 'No-show approved — appointment was unpaid so no credit needed', {
          appointment_id: id,
          missed_type:    type,
          action:         'marked_approved_no_payment',
        });
      }

      const chargeableAmount = appointment.final_amount ?? appointment.fee;
      const result = await creditDietitianForNoShow(appointment.dietitian_id, id, chargeableAmount, adminUserId);

      if (!result.credited) {
        if (result.reason === 'already_credited') return errorResponse(res, 409, 'Dietitian has already been credited');
        return errorResponse(res, 400, 'Could not credit dietitian wallet');
      }

      await markPaymentApproved(id, adminUserId);

      setImmediate(async () => {
        try {
          const dietitian = await findDietitianById(appointment.dietitian_id);
          if (dietitian?.email && result.details) {
            const mail = appointmentPaymentApprovedEmail({
              dietitianName:   dietitian.full_name ?? 'Dietitian',
              patientName:     appointment.name,
              appointmentDate: appointment.appointment_date,
              slot:            appointment.slot,
              grossAmount:     result.details.grossAmount,
              commission:      result.details.commission,
              netAmount:       result.details.netAmount,
              commPct:         result.details.commPct,
              currency:        appointment.currency,
              isNoShow:        true,
            });
            await sendEmail({ to: dietitian.email, subject: mail.subject, html: mail.html, text: mail.text })
              .catch((e) => console.error('[approve-no-show] Email failed:', e));
          }
        } catch (e) {
          console.error('[approve-no-show] Notification error:', e);
        }
      });

      return successResponse(res, 200, 'No-show approved — dietitian credited 50% of net fee', {
        appointment_id:  id,
        missed_type:     type,
        action:          'dietitian_credited',
        gross_amount:    result.details?.grossAmount,
        commission_pct:  result.details?.commPct,
        commission:      result.details?.commission,
        amount_credited: result.details?.netAmount,
        transaction_id:  result.transaction.id,
      });
    }

    // ── Dietitian no-show → refund patient + ₹100 penalty ────────────────────
    if (type === 'dietitian_no_show') {
      let refundId: string | null = null;

      // Guard: paid but no payment_id means data corruption — block before money moves
      if (appointment.payment_status === 'paid' && !appointment.payment_id) {
        return errorResponse(res, 400, 'Appointment is marked as paid but has no Razorpay payment ID — refund cannot be processed automatically. Resolve payment data first.');
      }

      // Skip Razorpay if already refunded (safe retry after partial failure)
      if (appointment.payment_status === 'paid' && appointment.payment_id) {
        try {
          const refundAmount = appointment.final_amount ?? appointment.fee;
          const refund = await razorpay.payments.refund(appointment.payment_id, {
            amount:  Math.round(refundAmount * 100),
            speed:   'normal',
            notes:   { reason: 'Dietitian did not attend the appointment', appointment_id: String(id) },
            receipt: `refund_appt_${id}`,
          });
          refundId = (refund as { id: string }).id;
          await markAppointmentPaymentRefunded(id);
        } catch (razorpayErr) {
          console.error('[approve-no-show] Razorpay refund failed:', razorpayErr);
          return errorResponse(res, 502, 'Razorpay refund failed — please retry or process manually');
        }
      } else if (appointment.payment_status === 'refunded') {
        refundId = 'already_refunded';
      }

      const penaltyResult = await debitDietitianForNoShowPenalty(
        appointment.dietitian_id, id, adminUserId, 'dietitian_no_show',
      );

      await markPaymentApproved(id, adminUserId);

      setImmediate(async () => {
        try {
          const dietitian = await findDietitianById(appointment.dietitian_id);
          if (dietitian?.email && penaltyResult.debited) {
            const mail = noShowPenaltyEmail({
              dietitianName:      dietitian.full_name ?? 'Dietitian',
              patientName:        appointment.name,
              appointmentDate:    appointment.appointment_date,
              slot:               appointment.slot,
              penaltyAmount:      NO_SHOW_PENALTY,
              walletBalanceAfter: penaltyResult.new_balance,
              missedType:         'dietitian_no_show',
              currency:           appointment.currency,
              isSuspended:        penaltyResult.suspended,
            });
            await sendEmail({ to: dietitian.email, subject: mail.subject, html: mail.html, text: mail.text })
              .catch((e) => console.error('[approve-no-show] Penalty email failed:', e));
          }
        } catch (e) {
          console.error('[approve-no-show] Dietitian no-show notification error:', e);
        }
      });

      return successResponse(res, 200, 'No-show approved — patient refunded, ₹100 penalty deducted from dietitian', {
        appointment_id:            id,
        missed_type:               type,
        action:                    'patient_refunded_and_dietitian_penalised',
        refund_id:                 refundId,
        refund_amount:             appointment.payment_status === 'paid' ? (appointment.final_amount ?? appointment.fee) : 0,
        penalty_deducted:          NO_SHOW_PENALTY,
        dietitian_wallet_balance:  penaltyResult.debited ? penaltyResult.new_balance : undefined,
        dietitian_suspended:       penaltyResult.debited ? penaltyResult.suspended   : undefined,
      });
    }

    // ── Both no-show → ₹100 penalty only, no refund ───────────────────────────
    const penaltyResult = await debitDietitianForNoShowPenalty(
      appointment.dietitian_id, id, adminUserId, 'both_no_show',
    );

    await markPaymentApproved(id, adminUserId);

    setImmediate(async () => {
      try {
        const dietitian = await findDietitianById(appointment.dietitian_id);
        if (dietitian?.email && penaltyResult.debited) {
          const mail = noShowPenaltyEmail({
            dietitianName:      dietitian.full_name ?? 'Dietitian',
            patientName:        appointment.name,
            appointmentDate:    appointment.appointment_date,
            slot:               appointment.slot,
            penaltyAmount:      NO_SHOW_PENALTY,
            walletBalanceAfter: penaltyResult.new_balance,
            missedType:         'both_no_show',
            currency:           appointment.currency,
            isSuspended:        penaltyResult.suspended,
          });
          await sendEmail({ to: dietitian.email, subject: mail.subject, html: mail.html, text: mail.text })
            .catch((e) => console.error('[approve-no-show] Both no-show email failed:', e));
        }
      } catch (e) {
        console.error('[approve-no-show] Both no-show notification error:', e);
      }
    });

    return successResponse(res, 200, 'No-show approved — ₹100 penalty deducted from dietitian, no refund to patient', {
      appointment_id:           id,
      missed_type:              type,
      action:                   'dietitian_penalised_no_refund',
      penalty_deducted:         NO_SHOW_PENALTY,
      dietitian_wallet_balance: penaltyResult.debited ? penaltyResult.new_balance : undefined,
      dietitian_suspended:      penaltyResult.debited ? penaltyResult.suspended   : undefined,
    });
  } catch (err) {
    console.error('Admin approve no-show error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
