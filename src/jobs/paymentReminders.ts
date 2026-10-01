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

const REMINDER_1_OFFER: Record<number, { planName: string; offer: string; price: string; coupon: string }> = {
  1: { planName: '7-Day Personalized Diet Plan',    offer: 'get 10% OFF',                       price: 'Pay just ₹179', coupon: 'SAVE10' },
  2: { planName: '1-Month Personalized Diet Plan',  offer: 'get 20% OFF',                       price: 'Pay just ₹399', coupon: 'SAVE20' },
  3: { planName: '3-Month Personalized Diet Plan',  offer: 'get a FREE Dietitian Consultation', price: 'Pay just ₹999', coupon: 'FREECONSULTATION' },
};

const REMINDER_2_OFFER: Record<number, { offer: string; coupon: string }> = {
  1: { offer: '10% OFF — Pay ₹179',         coupon: 'SAVE10' },
  2: { offer: '20% OFF — Pay ₹399',         coupon: 'SAVE20' },
  3: { offer: 'FREE Dietitian Consultation', coupon: 'FREECONSULTATION' },
};

const REMINDER_3_OFFER: Record<number, { planName: string; coupon: string }> = {
  1: { planName: '7-Day Personalized Diet Plan',   coupon: 'SAVE10' },
  2: { planName: '1-Month Personalized Diet Plan', coupon: 'SAVE20' },
  3: { planName: '3-Month Personalized Diet Plan', coupon: 'FREECONSULTATION' },
};

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
        const offer = REMINDER_1_OFFER[form.plan_type ?? 1] ?? REMINDER_1_OFFER[1];
        await sendPaymentReminder1WhatsApp(
          form.whatsapp,
          form.full_name ?? 'there',
          offer.planName,
          offer.offer,
          offer.price,
          offer.coupon,
        );
        await markPaymentReminderSent(form.id, 1);
        console.log(`[payment-reminder] R1 sent for form ${form.id}`);
      } catch (e) {
        console.error(`[payment-reminder] R1 failed for form ${form.id}:`, e);
      }
    }

    // ── Reminder 2 — 2 hours ───────────────────────────────────────────────
    for (const form of due2) {
      try {
        const offer2 = REMINDER_2_OFFER[form.plan_type ?? 1] ?? REMINDER_2_OFFER[1];
        await sendPaymentReminder2WhatsApp(
          form.whatsapp,
          form.full_name ?? 'there',
          offer2.offer,
          offer2.coupon,
        );
        await markPaymentReminderSent(form.id, 2);
        console.log(`[payment-reminder] R2 sent for form ${form.id}`);
      } catch (e) {
        console.error(`[payment-reminder] R2 failed for form ${form.id}:`, e);
      }
    }

    // ── Reminder 3 — 24 hours ──────────────────────────────────────────────
    for (const form of due3) {
      try {
        const offer3 = REMINDER_3_OFFER[form.plan_type ?? 1] ?? REMINDER_3_OFFER[1];
        await sendPaymentReminder3WhatsApp(
          form.whatsapp,
          form.full_name ?? 'there',
          offer3.planName,
          offer3.coupon,
        );
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
