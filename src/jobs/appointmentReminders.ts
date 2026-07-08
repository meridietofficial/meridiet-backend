import cron from 'node-cron';
import {
  getDue1hReminders,
  getDue10minReminders,
  getDueDietitian15minReminders,
  markReminderSent,
} from '../models/Appointment';
import { sendEmail } from '../services/email';
import { appointmentReminderEmail } from '../services/emails/appointmentReminder';
import { sendReminderWhatsApp, sendDietitianReminderWhatsApp } from '../services/whatsapp';
import { generateMeetingToken, userUid } from '../utils/meetingToken';
import { env } from '../config/env';

const buildJoinUrl = (appointmentId: number): string =>
  `${env.APP_BASE_URL}/meet/${appointmentId}?t=${generateMeetingToken(appointmentId, userUid(appointmentId))}`;

let isRunning = false;

const processReminders = async () => {
  if (isRunning) {
    console.warn('[reminder] Previous tick still running — skipping');
    return;
  }

  isRunning = true;

  try {
    // All 3 queries run in parallel — each hits a date-indexed path, not a full scan
    const [due1h, due10min, dueDietitian] = await Promise.all([
      getDue1hReminders(),
      getDue10minReminders(),
      getDueDietitian15minReminders(),
    ]);

    // ── User 1h reminders (email + WhatsApp) ───────────────────────────────
    for (const appt of due1h) {
      try {
        const isVideoCall = appt.session_type === 'video_call';
        const joinUrl = isVideoCall ? buildJoinUrl(appt.id) : undefined;

        if (appt.email) {
          const mail = appointmentReminderEmail({
            userName: appt.name,
            dietitianName: appt.dietitian_name,
            appointmentDate: appt.appointment_date,
            slot: appt.slot,
            sessionType: appt.session_type,
            joinUrl,
          });
          await sendEmail({ to: appt.email, subject: mail.subject, html: mail.html, text: mail.text })
            .catch((e) => console.error(`[reminder-1h] Email failed for appt ${appt.id}:`, e));
        }

        if (appt.phone) {
          await sendReminderWhatsApp(appt.phone, appt.name, appt.appointment_date, appt.slot, '1h', joinUrl)
            .catch((e) => console.error(`[reminder-1h] WhatsApp failed for appt ${appt.id}:`, e));
        }

        await markReminderSent(appt.id, '1h');
        console.log(`[reminder-1h] Sent for appointment ${appt.id}`);
      } catch (e) {
        console.error(`[reminder-1h] Failed for appointment ${appt.id}:`, e);
      }
    }

    // ── User 10min reminders (WhatsApp only) ───────────────────────────────
    for (const appt of due10min) {
      try {
        const isVideoCall = appt.session_type === 'video_call';
        const joinUrl = isVideoCall ? buildJoinUrl(appt.id) : undefined;

        if (appt.phone) {
          await sendReminderWhatsApp(appt.phone, appt.name, appt.appointment_date, appt.slot, '10min', joinUrl)
            .catch((e) => console.error(`[reminder-10min] WhatsApp failed for appt ${appt.id}:`, e));
        }

        await markReminderSent(appt.id, '10min');
        console.log(`[reminder-10min] Sent for appointment ${appt.id}`);
      } catch (e) {
        console.error(`[reminder-10min] Failed for appointment ${appt.id}:`, e);
      }
    }

    // ── Dietitian 15min reminders (WhatsApp only) ──────────────────────────
    for (const appt of dueDietitian) {
      try {
        if (appt.dietitian_phone) {
          await sendDietitianReminderWhatsApp(
            appt.dietitian_phone,
            appt.dietitian_name,
            appt.name,
            appt.slot,
          ).catch((e) => console.error(`[reminder-dietitian-15min] WhatsApp failed for appt ${appt.id}:`, e));
        }

        await markReminderSent(appt.id, 'dietitian_15min');
        console.log(`[reminder-dietitian-15min] Sent for appointment ${appt.id}`);
      } catch (e) {
        console.error(`[reminder-dietitian-15min] Failed for appointment ${appt.id}:`, e);
      }
    }
  } finally {
    isRunning = false;
  }
};

// Runs every 5 minutes
export const startAppointmentReminderJob = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await processReminders();
    } catch (err) {
      console.error('[cron] appointmentReminders failed:', err);
      isRunning = false;
    }
  });

  console.log('[cron] Appointment reminder job scheduled (every 5 minutes)');
};
