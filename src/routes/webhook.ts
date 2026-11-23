import { Router } from 'express';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { agoraWebhook } from '../controllers/appointment';
import { updateWithdrawalFromWebhook } from '../models/DietitianWithdrawal';
import type { WithdrawalStatus } from '../models/DietitianWithdrawal';
import { findByOrderId, markRegistrationPaid } from '../models/DietitianRegistrationPayment';
import { activateDietitianSubscription, findDietitianById } from '../models/Dietitian';
import { sendCapiPurchase } from '../utils/metaCapi';
import { creditRegistrationBonus } from '../models/DietitianWallet';
import { findAppointmentByOrderId, updateAppointmentPayment } from '../models/Appointment';
import { findPaymentByOrderId, markPaymentPaid } from '../models/Payment';
import { findDietFormById } from '../models/DietForm';
import { createCouponUsage } from '../models/Coupon';
import { getOrCreateRazorpayInvoice } from '../services/razorpayInvoice';
import { generateAndDeliverDietPlan } from '../services/dietPlanDelivery';
import { sendEmail } from '../services/email';
import { appointmentConfirmationEmail } from '../services/emails/appointmentConfirmation';
import { appointmentNewBookingEmail } from '../services/emails/appointmentNewBooking';
import { sendAppointmentBookedWhatsApp, sendDietitianNewBookingWhatsApp } from '../services/whatsapp';
import { generateMeetingToken, userUid } from '../utils/meetingToken';
import { sendAppointmentGstInvoiceEmail } from '../services/sendAppointmentGstInvoiceEmail';
import { env } from '../config/env';

export const webhookRouter = Router();

// POST /webhooks/agora — Agora Message Notification Service (no auth)
webhookRouter.post('/agora', agoraWebhook);

// POST /webhooks/cashfree — Cashfree Payouts transfer status updates
webhookRouter.post('/cashfree', async (req: Request, res: Response) => {
  try {
    // Signature verification (optional but recommended)
    const secret = env.CASHFREE_WEBHOOK_SECRET;
    if (secret) {
      const rawBody: Buffer | undefined = (req as unknown as Record<string, unknown>).rawBody as Buffer | undefined;
      const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);
      const signature = req.headers['x-webhook-signature'] as string;
      const expected  = crypto.createHmac('sha256', secret).update(bodyStr).digest('base64');
      if (signature && signature !== expected) {
        return res.status(400).json({ message: 'Invalid signature' });
      }
    }

    const type     = req.body?.type as string;
    const transfer = req.body?.data?.transfer ?? req.body?.transfer;

    // v2 uses snake_case (transfer_id), v1.2 used camelCase (transferId)
    const transferId = transfer?.transfer_id ?? transfer?.transferId;
    if (!transferId) return res.json({ status: 'ignored' });

    const STATUS_MAP: Record<string, WithdrawalStatus> = {
      'TRANSFER_SUCCESS':  'processed',
      'TRANSFER_FAILED':   'failed',
      'TRANSFER_REVERSED': 'reversed',
      'TRANSFER_REJECTED': 'cancelled',
    };

    const status = STATUS_MAP[type];
    if (!status) return res.json({ status: 'ignored' });

    await updateWithdrawalFromWebhook(transferId, status, {
      utr:            transfer.utr                                        ?? undefined,
      failure_reason: transfer.status_description ?? transfer.statusDescription ?? transfer.reason ?? undefined,
    });

    console.log(`Cashfree webhook: ${type} → transfer ${transferId} → ${status}`);
    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('cashfree webhook error:', err);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// POST /webhooks/razorpay — Razorpay payment events (payment.captured)
// Handles the case where the frontend drops off after payment but before
// calling /verify-payment — ensures dietitian is always activated.
webhookRouter.post('/razorpay', async (req: Request, res: Response) => {
  try {
    // Signature verification — always enforced; RAZORPAY_WEBHOOK_SECRET is required at startup
    const rawBody = (req as unknown as Record<string, unknown>).rawBody as Buffer | undefined;
    const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);
    const signature = req.headers['x-razorpay-signature'] as string;
    const expected  = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(bodyStr).digest('hex');
    if (!signature || signature !== expected) {
      console.warn('Razorpay webhook: invalid signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const event     = req.body?.event as string;
    const payment   = req.body?.payload?.payment?.entity;

    // Only handle captured payments
    if (event !== 'payment.captured' || !payment) {
      return res.json({ status: 'ignored' });
    }

    const orderId   = payment.order_id as string;
    const paymentId = payment.id as string;

    if (!orderId || !paymentId) return res.json({ status: 'ignored' });

    // Check if this is an appointment payment first
    const appointment = await findAppointmentByOrderId(orderId);
    if (appointment) {
      if (appointment.payment_status === 'paid') {
        console.log(`Razorpay webhook: appointment order ${orderId} already paid — skipping`);
        return res.json({ status: 'already_paid' });
      }
      // Atomic UPDATE: only one concurrent duplicate webhook can commit affectedRows=1
      const updated = await updateAppointmentPayment(orderId, paymentId, 'paid', 'confirmed');
      if (!updated) {
        console.log(`Razorpay webhook: appointment order ${orderId} lost concurrent update — skipping`);
        return res.json({ status: 'already_paid' });
      }
      // CAPI — fires only on the winning update
      void sendCapiPurchase({
        eventId:    orderId,
        value:      appointment.final_amount ?? appointment.fee,
        currency:   appointment.currency ?? 'INR',
        funnelType: 'consultation',
        email:      appointment.email,
        phone:      appointment.phone,
      }).catch((err) => console.error('[CAPI] webhook consultation purchase failed:', err));

      // Coupon usage — record now that appointment is atomically confirmed
      if (appointment.coupon_id && appointment.discount_applied != null && appointment.final_amount != null) {
        void createCouponUsage({
          coupon_id:        appointment.coupon_id,
          user_id:          appointment.user_id,
          applicable_type:  'appointment',
          payment_id:       null,
          appointment_id:   appointment.id,
          original_amount:  appointment.fee,
          discount_applied: appointment.discount_applied,
          final_amount:     appointment.final_amount,
        }).catch((err) => console.error('[webhook] consultation coupon usage failed:', err));
      }

      // GST invoice email
      void sendAppointmentGstInvoiceEmail(appointment.id)
        .catch((err) => console.error('[webhook] appointment GST invoice error:', err));
      // Booking confirmation: user + dietitian emails and WhatsApp
      void (async () => {
        try {
          const dietitian = await findDietitianById(appointment.dietitian_id);
          const dietitianName = dietitian?.full_name ?? 'Your Dietitian';
          const isVideoCall = appointment.session_type === 'video_call';
          const userJoinUrl = isVideoCall
            ? `${env.APP_BASE_URL}/meet/${appointment.id}?t=${generateMeetingToken(appointment.id, userUid(appointment.id))}`
            : undefined;
          if (appointment.email) {
            const userMail = appointmentConfirmationEmail({
              userName: appointment.name, dietitianName,
              appointmentDate: appointment.appointment_date, slot: appointment.slot,
              sessionType: appointment.session_type, fee: appointment.fee,
              currency: appointment.currency, joinUrl: userJoinUrl,
            });
            await sendEmail({ to: appointment.email, subject: userMail.subject, html: userMail.html, text: userMail.text })
              .catch((e) => console.error('[webhook] appointment user email failed:', e));
          }
          if (dietitian?.email) {
            const dietMail = appointmentNewBookingEmail({
              dietitianName, patientName: appointment.name,
              appointmentDate: appointment.appointment_date, slot: appointment.slot,
              sessionType: appointment.session_type, notes: appointment.notes,
            });
            await sendEmail({ to: dietitian.email, subject: dietMail.subject, html: dietMail.html, text: dietMail.text })
              .catch((e) => console.error('[webhook] appointment dietitian email failed:', e));
          }
          if (appointment.phone) {
            await sendAppointmentBookedWhatsApp(
              appointment.phone, appointment.name, appointment.appointment_date, appointment.slot, userJoinUrl,
            ).catch((e) => console.error('[webhook] appointment user WhatsApp failed:', e));
          }
          if (dietitian?.phone_number) {
            const dietitianPhone = dietitian.phone_code
              ? `${dietitian.phone_code}${dietitian.phone_number}`
              : dietitian.phone_number;
            await sendDietitianNewBookingWhatsApp(
              dietitianPhone!, dietitianName, appointment.name, appointment.appointment_date, appointment.slot,
            ).catch((e) => console.error('[webhook] appointment dietitian WhatsApp failed:', e));
          }
        } catch (e) {
          console.error('[webhook] appointment post-payment notification error:', e);
        }
      })();
      console.log(`Razorpay webhook: payment.captured → appointment ${appointment.id} marked paid`);
      return res.json({ status: 'ok' });
    }

    // Check if this is a diet plan payment
    const dietPayment = await findPaymentByOrderId(orderId);
    if (dietPayment) {
      if (dietPayment.status === 'paid') {
        console.log(`Razorpay webhook: diet plan order ${orderId} already paid — skipping`);
        return res.json({ status: 'already_paid' });
      }

      if (!dietPayment.diet_form_id) {
        console.log(`Razorpay webhook: diet plan order ${orderId} has no diet_form_id — ignoring`);
        return res.json({ status: 'ignored' });
      }

      // Atomic UPDATE: only one concurrent duplicate webhook can commit affectedRows=1
      const updated = await markPaymentPaid(orderId, paymentId, '', dietPayment.diet_form_id);
      if (!updated) {
        console.log(`Razorpay webhook: diet plan order ${orderId} lost concurrent update — skipping`);
        return res.json({ status: 'already_paid' });
      }

      const form = await findDietFormById(dietPayment.diet_form_id);
      if (form) {
        const userId = form.user_id ?? dietPayment.user_id;
        const weeksOverride = dietPayment.plan === '3_months' ? 4 : undefined;
        void generateAndDeliverDietPlan(form.id, userId, weeksOverride).catch((err) => {
          console.error('[webhook] diet plan delivery error:', err);
        });
      }
      void sendCapiPurchase({
        eventId:    orderId,
        value:      dietPayment.final_amount ?? dietPayment.amount,
        currency:   dietPayment.currency ?? 'INR',
        funnelType: 'diet_plan',
        email:      form?.email ?? null,
        phone:      form?.whatsapp ?? null,
      }).catch((err) => console.error('[CAPI] webhook diet_plan purchase failed:', err));

      // Coupon usage — record now that payment is atomically confirmed
      if (dietPayment.coupon_id && dietPayment.discount_applied != null && dietPayment.final_amount != null) {
        void createCouponUsage({
          coupon_id:        dietPayment.coupon_id,
          user_id:          dietPayment.user_id,
          applicable_type:  'diet_plan',
          payment_id:       dietPayment.id,
          appointment_id:   null,
          original_amount:  dietPayment.amount,
          discount_applied: dietPayment.discount_applied,
          final_amount:     dietPayment.final_amount,
        }).catch((err) => console.error('[webhook] diet_plan coupon usage failed:', err));
      }

      // Razorpay invoice — email delivered directly to customer by Razorpay
      if (form?.email) {
        void getOrCreateRazorpayInvoice({
          razorpayOrderId: orderId,
          customerName:    form.full_name ?? 'Customer',
          customerEmail:   form.email,
          customerPhone:   form.whatsapp ?? null,
          plan:            dietPayment.plan,
          amountPaid:      dietPayment.final_amount ?? dietPayment.amount,
        }).catch((err) => console.error('[webhook] diet_plan invoice error:', err));
      }

      console.log(`Razorpay webhook: payment.captured → diet plan order ${orderId} (form ${dietPayment.diet_form_id}) marked paid`);
      return res.json({ status: 'ok' });
    }

    // Find the registration payment record
    const record = await findByOrderId(orderId);
    if (!record) {
      console.log(`Razorpay webhook: no record for order ${orderId} — ignoring`);
      return res.json({ status: 'ignored' });
    }

    // Already paid — idempotent
    if (record.status === 'paid') {
      console.log(`Razorpay webhook: order ${orderId} already paid — skipping`);
      return res.json({ status: 'already_paid' });
    }

    // Atomic UPDATE: only one concurrent duplicate webhook can commit affectedRows=1
    const updated = await markRegistrationPaid(record.id, paymentId, '');
    if (!updated) {
      console.log(`Razorpay webhook: registration order ${orderId} lost concurrent update — skipping`);
      return res.json({ status: 'already_paid' });
    }

    // Activate subscription (safe even if already active)
    if (record.dietitian_id) {
      await activateDietitianSubscription(record.dietitian_id);

      // Credit 500 AI plan credits — idempotent via fixed reference_id
      void creditRegistrationBonus(record.dietitian_id)
        .catch((err) => console.error('Razorpay webhook: plan credit failed:', err));

      const dietitian = await findDietitianById(record.dietitian_id).catch(() => null);
      const phone = dietitian?.phone_code
        ? `${dietitian.phone_code}${dietitian.phone_number}`
        : (dietitian?.phone_number ?? null);
      void sendCapiPurchase({
        eventId:    orderId,
        value:      record.amount,
        currency:   'INR',
        funnelType: 'dietitian_onboarding',
        email:      record.email,
        phone,
      }).catch((err) => console.error('[CAPI] webhook dietitian_onboarding purchase failed:', err));
    }

    console.log(`Razorpay webhook: payment.captured → order ${orderId} → dietitian ${record.dietitian_id} activated`);
    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('Razorpay webhook error:', err);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
});
