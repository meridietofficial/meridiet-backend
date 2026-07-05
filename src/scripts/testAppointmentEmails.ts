import 'dotenv/config';
import { sendEmail } from '../services/email';
import { appointmentConfirmationEmail } from '../services/emails/appointmentConfirmation';
import { appointmentNewBookingEmail } from '../services/emails/appointmentNewBooking';

const TEST_TO = 'mannu@yopmail.com';

const SAMPLE = {
  userName:        'Manish Kumar',
  dietitianName:   'Kajal Panday',
  appointmentDate: '2026-07-10',
  slot:            '10:00',
  sessionType:     'video_call' as const,
  fee:             500,
  currency:        'INR',
  patientNotes:    'I want to lose weight and improve my overall diet.',
};

const run = async () => {
  console.log(`\nSending test appointment emails to ${TEST_TO}...\n`);

  // ── 1. User confirmation email ───────────────────────────────────────────────
  const userMail = appointmentConfirmationEmail({
    userName:        SAMPLE.userName,
    dietitianName:   SAMPLE.dietitianName,
    appointmentDate: SAMPLE.appointmentDate,
    slot:            SAMPLE.slot,
    sessionType:     SAMPLE.sessionType,
    fee:             SAMPLE.fee,
    currency:        SAMPLE.currency,
  });

  await sendEmail({ to: TEST_TO, subject: userMail.subject, html: userMail.html, text: userMail.text });
  console.log('✅ User confirmation email sent');
  console.log('   Subject:', userMail.subject);

  // ── 2. Dietitian new booking email ───────────────────────────────────────────
  const dietMail = appointmentNewBookingEmail({
    dietitianName:   SAMPLE.dietitianName,
    patientName:     SAMPLE.userName,
    appointmentDate: SAMPLE.appointmentDate,
    slot:            SAMPLE.slot,
    sessionType:     SAMPLE.sessionType,
    notes:           SAMPLE.patientNotes,
  });

  await sendEmail({ to: TEST_TO, subject: dietMail.subject, html: dietMail.html, text: dietMail.text });
  console.log('✅ Dietitian new-booking email sent');
  console.log('   Subject:', dietMail.subject);

  console.log('\nDone. Check mannu@yopmail.com\n');
};

run().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
