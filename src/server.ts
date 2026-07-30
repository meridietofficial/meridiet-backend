import 'dotenv/config';
import os from 'os';
import { app } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { startMissedAppointmentJob } from './jobs/missedAppointments';
import { startAppointmentReminderJob } from './jobs/appointmentReminders';
import { startBroadcastCleanupJob } from './jobs/broadcastCleanup';

const getNetworkIP = (): string | null => {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
};

const startServer = async () => {
  const server = app.listen(env.PORT, () => {
    const networkIP = getNetworkIP();
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    if (networkIP) console.log(`🌐 Network:  http://${networkIP}:${env.PORT}`);
    console.log(`📖 API: http://localhost:${env.PORT}${env.API_PREFIX}/${env.API_VERSION}`);
  });

  try {
    await connectDatabase();
    startMissedAppointmentJob();
    startAppointmentReminderJob();
    startBroadcastCleanupJob();
  } catch (err) {
    console.error('❌ DB connection failed:', (err as Error).message);
  }

  process.on('SIGINT', () => {
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
};

startServer().catch(console.error);
