import type { RequestHandler } from 'express';
import { AUTH_COOKIE, verifyToken } from '../lib/token.js';
import { UnauthorizedError } from '../lib/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

/** Requires a valid auth cookie and sets req.userId. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string') throw new UnauthorizedError();
  req.userId = verifyToken(token);
  next();
};

/** For handlers behind `authenticate`: returns the user id or throws. */
export function currentUserId(req: { userId?: string }): string {
  if (!req.userId) throw new UnauthorizedError();
  return req.userId;
}
