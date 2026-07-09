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

// Security — CSP disabled globally (API routes return JSON, CSP only matters for HTML)
// The /meet page sets its own permissive CSP below to allow Agora SDK + WebRTC
app.use(helmet({ contentSecurityPolicy: false }));
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
// Permissive CSP required: Agora SDK (CDN), inline JS, WebRTC connections, camera/mic
app.use('/meet', helmet.contentSecurityPolicy({
  useDefaults: false,
  directives: {
    defaultSrc:    ["'self'"],
    scriptSrc:     ["'self'", "'unsafe-inline'", 'https://download.agora.io'],
    scriptSrcAttr: ["'unsafe-inline'"],
    connectSrc:    ["'self'", 'https:', 'wss:'],
    mediaSrc:      ['*'],
    imgSrc:        ["'self'", 'data:', 'blob:'],
    workerSrc:     ['blob:'],
    styleSrc:      ["'self'", "'unsafe-inline'"],
    frameAncestors:["'none'"],
    objectSrc:     ["'none'"],
  },
}), meetRouter);

// 404 & error handler
app.use(notFound);
app.use(errorHandler);
