import type { CorsOptions } from 'cors';
import { env } from './env';

const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

// In development: allow any localhost port and local network IPs automatically
const LOCAL_NETWORK_RE = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;
const LOCALHOST_RE      = /^https?:\/\/localhost(:\d+)?$/;

const isAllowed = (origin: string) =>
  allowedOrigins.includes(origin) ||
  (env.NODE_ENV !== 'production' && (
    LOCAL_NETWORK_RE.test(origin) ||
    LOCALHOST_RE.test(origin)
  ));

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (isAllowed(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin "${origin}" not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86_400, // 24 hours preflight cache
};
