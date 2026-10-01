import type { FieldErrors } from '@flashcards/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError, z } from 'zod';
import { isRecordNotFound, isUniqueViolation } from '../lib/prismaErrors.js';
import { AppError } from '../lib/errors.js';
import { ResponseContractError, sendError } from '../lib/respond.js';
import { isProd } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, 404, 'Route not found');
};

/**
 * Single place that turns errors into HTTP responses:
 *   ZodError               → 400 (invalid body or id, with per-field messages)
 *   AppError subclasses    → their status (404 NotFound, 409 Conflict, 401 …)
 *   Prisma P2002 (unique)  → 409 (services normally catch this first with a specific message)
 *   Prisma P2025 (missing) → 404 (likewise)
 *   body-parser errors     → 400 (malformed JSON) / 413 (too large)
 *   ResponseContractError  → 500: the server tried to send data breaking its own contract (a bug)
 *   anything else          → 500 (message hidden in production)
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    // formErrors holds object-level problems, e.g. 'Unrecognized key: "userId"' from strict schemas.
    const { formErrors, fieldErrors } = z.flattenError(err);
    // The message names the first problem ("Invalid deck id", "Title is required"), so clients that
    // only show `message` are still useful; `details` keeps every field's messages.
    const firstFieldError = Object.values(fieldErrors as FieldErrors)[0]?.[0];
    sendError(res, 400, formErrors[0] ?? firstFieldError ?? 'Invalid input', fieldErrors as FieldErrors);
    return;
  }
  if (err instanceof AppError) {
    sendError(res, err.status, err.message, err.details);
    return;
  }
  // Safety net only: services translate these into specific messages ("You already have a deck named …").
  if (isUniqueViolation(err)) {
    sendError(res, 409, 'That already exists');
    return;
  }
  if (isRecordNotFound(err)) {
    sendError(res, 404, 'Not found');
    return;
  }
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    sendError(res, err.status, err.type === 'entity.parse.failed' ? 'Malformed JSON body' : err.message);
    return;
  }

  if (err instanceof ResponseContractError) {
    req.log.error({ route: err.route, issues: err.issues }, err.message);
    sendError(res, 500, isProd ? 'Something went wrong' : err.message);
    return;
  }

  req.log.error({ err }, 'Unhandled error');
  sendError(res, 500, isProd ? 'Something went wrong' : String(err?.message ?? err));
};
