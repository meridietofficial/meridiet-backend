import cron from 'node-cron';
import { markMissedAppointments } from '../models/Appointment';

// Runs every hour — marks confirmed appointments whose date+slot has passed as 'missed'
export const startMissedAppointmentJob = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      const affected = await markMissedAppointments();
      if (affected > 0) {
        console.log(`[cron] Marked ${affected} appointment(s) as missed`);
      }
    } catch (err) {
      console.error('[cron] markMissedAppointments failed:', err);
    }
  });

  console.log('[cron] Missed-appointment job scheduled (every hour)');
};
