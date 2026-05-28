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

export const app = express();

// Security
app.use(helmet());
app.use(cors(corsOptions));

// Rate limiting
app.use(
  env.API_PREFIX,
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    message: { success: false, message: 'Too many requests, please try again later.' },
  }),
);

// Body parsing & logging
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is healthy 🟢' });
});

// API routes
app.use(`${env.API_PREFIX}/${env.API_VERSION}`, router);

// 404 & error handler
app.use(notFound);
app.use(errorHandler);
