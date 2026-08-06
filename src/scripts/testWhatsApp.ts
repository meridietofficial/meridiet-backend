import 'dotenv/config';
import {
  sendFormReceivedWhatsApp,
  sendAppointmentBookedWhatsApp,
  sendDietitianNewBookingWhatsApp,
  sendAppointmentConfirmedWhatsApp,
  sendFollowUpScheduledWhatsApp,
  sendAppointmentRescheduledWhatsApp,
  sendDietitianRescheduledWhatsApp,
  sendReminderWhatsApp,
  sendDietitianReminderWhatsApp,
  sendDietPlanWhatsApp,
  sendAppointmentCompletedWhatsApp,
} from '../services/whatsapp';
import { env } from '../config/env';

const TEST_PHONE    = '8882897525';
const TEST_DATE     = '2026-08-10';
const PREV_DATE     = '2026-08-07';
const TEST_SLOT     = '10:00';
const PREV_SLOT     = '09:00';
const JOIN_URL      = `${env.APP_BASE_URL}/meet/99?t=testtoken123`;
const TEST_PDF_URL  = `${env.AWS_S3_BASE_URL}/diet-plans/test-plan.pdf`;

type Step = { label: string; fn: () => Promise<void> };

const steps: Step[] = [
  {
    label: 'form_received → meri_diet_form_received',
    fn: () => sendFormReceivedWhatsApp(TEST_PHONE, 'Manish'),
  },
  {
    label: 'appointment_booked → consultation_booked',
    fn: () => sendAppointmentBookedWhatsApp(TEST_PHONE, 'Manish', TEST_DATE, TEST_SLOT, JOIN_URL),
  },
  {
    label: 'dietitian_new_booking → dietitian_new_booking',
    fn: () => sendDietitianNewBookingWhatsApp(TEST_PHONE, 'Dr. Priya', 'Manish', TEST_DATE, TEST_SLOT),
  },
  {
    label: 'appointment_confirmed → consultation_confirmed',
    fn: () => sendAppointmentConfirmedWhatsApp(TEST_PHONE, 'Manish', TEST_DATE, TEST_SLOT, JOIN_URL),
  },
  {
    label: 'follow_up_booked → follow_up_booked',
    fn: () => sendFollowUpScheduledWhatsApp(TEST_PHONE, 'Manish', TEST_DATE, TEST_SLOT, JOIN_URL),
  },
  {
    label: 'appointment_rescheduled → consultation_rescheduled',
    fn: () => sendAppointmentRescheduledWhatsApp(TEST_PHONE, 'Manish', PREV_DATE, PREV_SLOT, TEST_DATE, TEST_SLOT, JOIN_URL),
  },
  {
    label: 'dietitian_rescheduled → dietitian_appointment_rescheduled',
    fn: () => sendDietitianRescheduledWhatsApp(TEST_PHONE, 'Dr. Priya', 'Manish', PREV_DATE, PREV_SLOT, TEST_DATE, TEST_SLOT),
  },
  {
    label: 'reminder_1h → consultation_reminder_1h',
    fn: () => sendReminderWhatsApp(TEST_PHONE, 'Manish', TEST_DATE, TEST_SLOT, '1h', JOIN_URL),
  },
  {
    label: 'reminder_10min → consultation_reminder_10min',
    fn: () => sendReminderWhatsApp(TEST_PHONE, 'Manish', TEST_DATE, TEST_SLOT, '10min', JOIN_URL),
  },
  {
    label: 'dietitian_reminder_15min → dietitian_reminder_15min',
    fn: () => sendDietitianReminderWhatsApp(TEST_PHONE, 'Dr. Priya', 'Manish', TEST_SLOT),
  },
  {
    label: 'diet_plan_ready → meri_diet_plan_ready',
    fn: () => sendDietPlanWhatsApp(TEST_PHONE, 'Manish', TEST_PDF_URL),
  },
  {
    label: 'appointment_completed → consultation_completed',
    fn: () => sendAppointmentCompletedWhatsApp(TEST_PHONE, 'Manish', TEST_DATE, TEST_SLOT),
  },
];

(async () => {
  console.log(`\nSending all ${steps.length} WhatsApp templates to ${TEST_PHONE}\n`);
  for (const { label, fn } of steps) {
    process.stdout.write(`  [→] ${label} ... `);
    try {
      await fn();
      console.log('queued');
    } catch (e) {
      console.error('FAILED', e);
    }
  }
  console.log('\nDone — check the phone.');
})();
