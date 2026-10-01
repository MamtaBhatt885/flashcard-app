import { Router } from 'express';
import rateLimit, { type RateLimitInfo } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { PrismaRateLimitStore } from '../../lib/rateLimitStore.js';
import { sendError } from '../../lib/respond.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authController } from './auth.controller.js';

// Rate-limit only the endpoints that check passwords.
const credentialLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Counters live in the database: they survive restarts and are shared across API processes.
  store: new PrismaRateLimitStore('auth:'),
  // 429 bodies follow the ApiError contract like every other error.
  handler: (req, res, _next, options) => {
    // express-rate-limit attaches its state to the request; Express's types don't know about it.
    const resetTime = (req as typeof req & { rateLimit?: RateLimitInfo }).rateLimit?.resetTime;
    const minutes = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60_000)) : undefined;
    const when = minutes ? `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` : 'later';
    sendError(res, options.statusCode, `Too many attempts. Try again ${when}.`);
  },
});

export const authRouter = Router()
  .post('/signup', credentialLimiter, authController.signup)
  .post('/login', credentialLimiter, authController.login)
  .post('/logout', authController.logout)
  .get('/me', authenticate, authController.me);
