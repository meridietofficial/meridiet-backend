import cron from 'node-cron';
import { execute } from '../config/database';
import { RECIPIENT_RETENTION_DAYS } from '../controllers/adminBroadcast';

const cleanup = async () => {
  const result = await execute(
    `DELETE FROM broadcast_recipients WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [RECIPIENT_RETENTION_DAYS],
  );
  if (result.affectedRows > 0) {
    console.log(`[broadcast-cleanup] Purged ${result.affectedRows} recipient rows older than ${RECIPIENT_RETENTION_DAYS} days`);
  }
};

// Runs daily at 02:00 AM
export const startBroadcastCleanupJob = () => {
  cron.schedule('0 2 * * *', async () => {
    try {
      await cleanup();
    } catch (err) {
      console.error('[broadcast-cleanup] Failed:', err);
    }
  });

  console.log('[cron] Broadcast cleanup job scheduled (daily at 02:00)');
};
