import { prisma } from '../../lib/prisma.js';

const publicUser = { id: true, email: true } as const;

export const authRepository = {
  /** The one query that needs the hash: login. */
  findCredentials(email: string) {
    return prisma.user.findUnique({ where: { email }, select: { ...publicUser, passwordHash: true } });
  },
  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: publicUser });
  },
  create(email: string, passwordHash: string) {
    return prisma.user.create({ data: { email, passwordHash }, select: publicUser });
  },
};
