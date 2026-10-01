import { Prisma } from '../generated/prisma/client.js';

/** The write hit a unique constraint (e.g. @@unique([userId, title])). */
export const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** An update/delete matched no row (including because an ownership filter excluded it). */
export const isRecordNotFound = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
