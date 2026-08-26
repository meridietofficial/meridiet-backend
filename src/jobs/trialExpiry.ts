import cron from 'node-cron';
import { expireTrialDietitians } from '../models/Dietitian';

export const startTrialExpiryJob = () => {
  // Runs every day at 00:05 AM
  cron.schedule('5 0 * * *', async () => {
    try {
      const count = await expireTrialDietitians();
      if (count > 0) {
        console.log(`[trialExpiry] Expired ${count} dietitian trial(s)`);
      }
    } catch (err) {
      console.error('[trialExpiry] Job failed:', err);
    }
  });

  console.log('[trialExpiry] Trial expiry job scheduled (daily 00:05)');
};
