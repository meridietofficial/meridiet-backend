import cron from 'node-cron';
import {
  getDuePaymentReminder1Forms,
  getDuePaymentReminder2Forms,
  getDuePaymentReminder3Forms,
  markPaymentReminderSent,
} from '../models/DietForm';
import {
  sendPaymentReminder1WhatsApp,
  sendPaymentReminder2WhatsApp,
  sendPaymentReminder3WhatsApp,
} from '../services/whatsapp';

let isRunning = false;

const processPaymentReminders = async () => {
  if (isRunning) {
    console.warn('[payment-reminder] Previous tick still running — skipping');
    return;
  }

  isRunning = true;

  try {
    const [due1, due2, due3] = await Promise.all([
      getDuePaymentReminder1Forms(),
      getDuePaymentReminder2Forms(),
      getDuePaymentReminder3Forms(),
    ]);

    // ── Reminder 1 — 10 minutes ────────────────────────────────────────────
    for (const form of due1) {
      try {
        await sendPaymentReminder1WhatsApp(form.whatsapp, form.full_name ?? 'there');
        await markPaymentReminderSent(form.id, 1);
        console.log(`[payment-reminder] R1 sent for form ${form.id}`);
      } catch (e) {
        console.error(`[payment-reminder] R1 failed for form ${form.id}:`, e);
      }
    }

    // ── Reminder 2 — 2 hours ───────────────────────────────────────────────
    for (const form of due2) {
      try {
        await sendPaymentReminder2WhatsApp(form.whatsapp, form.full_name ?? 'there');
        await markPaymentReminderSent(form.id, 2);
        console.log(`[payment-reminder] R2 sent for form ${form.id}`);
      } catch (e) {
        console.error(`[payment-reminder] R2 failed for form ${form.id}:`, e);
      }
    }

    // ── Reminder 3 — 24 hours ──────────────────────────────────────────────
    for (const form of due3) {
      try {
        await sendPaymentReminder3WhatsApp(form.whatsapp, form.full_name ?? 'there');
        await markPaymentReminderSent(form.id, 3);
        console.log(`[payment-reminder] R3 sent for form ${form.id}`);
      } catch (e) {
        console.error(`[payment-reminder] R3 failed for form ${form.id}:`, e);
      }
    }
  } finally {
    isRunning = false;
  }
};

export const startPaymentReminderJob = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await processPaymentReminders();
    } catch (err) {
      console.error('[cron] paymentReminders failed:', err);
      isRunning = false;
    }
  });

  console.log('[cron] Payment reminder job scheduled (every 5 minutes)');
};
