import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { corsOptions } from './config/cors';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { router } from './routes';
import { meetRouter } from './routes/meet';

export const app = express();

// Security
app.use(helmet());
app.use(cors(corsOptions));

// Rate limiting — strict on auth, relaxed everywhere else
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

app.use(`${env.API_PREFIX}/${env.API_VERSION}/auth`, authLimiter);
app.use(env.API_PREFIX, globalLimiter);

// Body parsing & logging
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan('dev'));

// Root
app.get('/', (_req, res) => {
  res.json({ success: true, message: 'Meri Diet server is working fine' });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is healthy 🟢' });
});

// API routes
app.use(`${env.API_PREFIX}/${env.API_VERSION}`, router);

// Meeting room — served as HTML, outside the API prefix
// GET /meet/:appointmentId?t=<signed-token>
app.use('/meet', meetRouter);

// 404 & error handler
app.use(notFound);
app.use(errorHandler);
