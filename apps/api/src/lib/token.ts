import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env.js';
import { UnauthorizedError } from './errors.js';

export const AUTH_COOKIE = 'token';

// Derived from the environment instead of being hard-coded at each call site.
export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  domain: env.COOKIE_DOMAIN,
  maxAge: env.JWT_EXPIRES_IN_SECONDS * 1000,
  path: '/',
};

export function signToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) throw new Error('bad payload');
    return payload.sub;
  } catch {
    throw new UnauthorizedError('Session expired, please sign in again');
  }
}
