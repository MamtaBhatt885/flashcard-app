import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { z } from 'zod';
import { logger } from './lib/logger.js';
import { sendJson } from './lib/respond.js';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { decksRouter } from './modules/decks/decks.routes.js';
import { cardsRouter } from './modules/cards/cards.routes.js';
import { sessionsRouter } from './modules/sessions/sessions.routes.js';

const healthSchema = z.object({ status: z.literal('ok') });

export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    sendJson(res, healthSchema, { status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/decks', authenticate, decksRouter);
  app.use('/api/cards', authenticate, cardsRouter);
  app.use('/api/sessions', authenticate, sessionsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
