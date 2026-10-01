import { apiErrorSchema, type FieldErrors } from '@flashcards/shared';
import type { Response } from 'express';
import type { z } from 'zod';

/**
 * Thrown when the server is about to send data that breaks its own shared contract.
 * That's always a server bug (e.g. a mapper returned a Date instead of an ISO string),
 * so the error handler answers 500 and logs the exact issue instead of shipping bad data.
 */
export class ResponseContractError extends Error {
  constructor(
    public readonly route: string,
    public readonly issues: z.core.$ZodIssue[],
  ) {
    const first = issues[0];
    super(`Response for ${route} broke its contract: ${first ? `${first.path.join('.') || '(root)'} ${first.message}` : 'invalid'}`);
    this.name = 'ResponseContractError';
  }
}

/**
 * The only way controllers send JSON. The data is PARSED with the shared response schema first:
 * - wrong/missing fields → ResponseContractError (500, logged), never sent to the client
 * - fields not in the contract (e.g. a stray `passwordHash`) are stripped, never leaked
 * `data` is typed as the schema's input, so most mistakes are caught at compile time too.
 */
export function sendJson<S extends z.ZodType>(res: Response, schema: S, data: z.input<S>, status = 200): void {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ResponseContractError(`${res.req.method} ${res.req.originalUrl}`, parsed.error.issues);
  res.status(status).json(parsed.data);
}

/**
 * Error bodies go through the ApiError contract too. This runs inside the error handler,
 * so it must never throw: if the body somehow doesn't fit, fall back to a plain message.
 */
export function sendError(res: Response, status: number, message: string, details?: FieldErrors): void {
  const parsed = apiErrorSchema.safeParse(details ? { message, details } : { message });
  res.status(status).json(parsed.success ? parsed.data : { message: 'Something went wrong' });
}
