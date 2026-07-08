import 'dotenv/config';
import { sendAppointmentBookedWhatsApp } from '../services/whatsapp';
import { env } from '../config/env';

const TEST_PHONE = '8882897525';
const JOIN_URL = `${env.APP_BASE_URL}/meet/99?t=testtoken123`;

(async () => {
  console.log(`Sending consultation_booked test to ${TEST_PHONE} with joinUrl...`);
  try {
    await sendAppointmentBookedWhatsApp(
      TEST_PHONE,
      'Manish',
      '2026-07-10',
      '10:00',
      JOIN_URL,
    );
    console.log('Done — check the phone.');
  } catch (e) {
    console.error('Failed:', e);
  }
})();
