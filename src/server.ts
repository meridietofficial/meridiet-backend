import 'dotenv/config';
import { app } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { startMissedAppointmentJob } from './jobs/missedAppointments';

const startServer = async () => {
  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`📖 API: http://localhost:${env.PORT}${env.API_PREFIX}/${env.API_VERSION}`);
  });

  try {
    await connectDatabase();
    startMissedAppointmentJob();
  } catch (err) {
    console.error('❌ DB connection failed:', (err as Error).message);
  }

  process.on('SIGINT', () => {
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
};

startServer().catch(console.error);
