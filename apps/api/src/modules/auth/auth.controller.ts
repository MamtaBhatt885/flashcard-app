import { credentialsSchema, userSchema } from '@flashcards/shared';
import type { Request, Response } from 'express';
import { sendJson } from '../../lib/respond.js';
import { AUTH_COOKIE, authCookieOptions } from '../../lib/token.js';
import { currentUserId } from '../../middleware/authenticate.js';
import { authService } from './auth.service.js';

export const authController = {
  async signup(req: Request, res: Response) {
    const { user, token } = await authService.signup(credentialsSchema.parse(req.body));
    res.cookie(AUTH_COOKIE, token, authCookieOptions);
    sendJson(res, userSchema, user, 201);
  },

  async login(req: Request, res: Response) {
    const { user, token } = await authService.login(credentialsSchema.parse(req.body));
    res.cookie(AUTH_COOKIE, token, authCookieOptions);
    sendJson(res, userSchema, user);
  },

  logout(_req: Request, res: Response) {
    const { maxAge: _maxAge, ...clearOptions } = authCookieOptions;
    res.clearCookie(AUTH_COOKIE, clearOptions).status(204).end();
  },

  async me(req: Request, res: Response) {
    sendJson(res, userSchema, await authService.me(currentUserId(req)));
  },
};
