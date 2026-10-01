import type { CredentialsInput, User } from '@flashcards/shared';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { ConflictError, UnauthorizedError } from '../../lib/errors.js';
import { isUniqueViolation } from '../../lib/prismaErrors.js';
import { signToken } from '../../lib/token.js';
import { authRepository } from './auth.repository.js';

// Used when the email doesn't exist, so login takes the same time either way
// (otherwise response timing reveals which emails are registered).
const DUMMY_HASH = hashPassword('timing-equalizer-not-a-real-password');

export const authService = {
  /** The unique index on email decides duplicates: no racy "is it taken?" pre-check. */
  async signup({ email, password }: CredentialsInput): Promise<{ user: User; token: string }> {
    const user = await authRepository.create(email, await hashPassword(password)).catch((err) => {
      if (isUniqueViolation(err)) throw new ConflictError('An account with that email already exists');
      throw err;
    });
    return { user, token: signToken(user.id) };
  },

  async login({ email, password }: CredentialsInput): Promise<{ user: User; token: string }> {
    const found = await authRepository.findCredentials(email);
    const ok = await verifyPassword(password, found?.passwordHash ?? (await DUMMY_HASH));
    if (!found || !ok) throw new UnauthorizedError('Incorrect email or password');
    return { user: { id: found.id, email: found.email }, token: signToken(found.id) };
  },

  async me(userId: string): Promise<User> {
    const user = await authRepository.findById(userId);
    if (!user) throw new UnauthorizedError();
    return user;
  },
};
