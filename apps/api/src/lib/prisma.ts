import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

// One client for the whole process. The libSQL adapter talks to the SQLite file in DATABASE_URL.
// Set LOG_QUERIES=true to print every SQL statement: the quickest way to spot N+1 patterns.
export const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: env.DATABASE_URL }),
  log: env.LOG_QUERIES ? [{ emit: 'event', level: 'query' }] : [],
});

if (env.LOG_QUERIES) {
  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    console.log(`[sql ${e.duration}ms] ${e.query}`);
  });
}
