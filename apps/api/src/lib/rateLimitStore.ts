import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { prisma } from './prisma.js';

type CounterRow = { hits: number | bigint; resetAt: number | bigint };
const toInfo = (row: CounterRow): ClientRateLimitInfo => ({
  totalHits: Number(row.hits),
  resetTime: new Date(Number(row.resetAt)),
});

/**
 * express-rate-limit store backed by the RateLimit table.
 *
 * Before: the default MemoryStore. Every restart (including each `tsx watch` reload) wiped all
 * counters, so password guessing could simply continue after a restart, and two API processes
 * would each allow the full limit.
 *
 * Counting is ONE atomic SQL statement (INSERT … ON CONFLICT DO UPDATE … RETURNING). SQLite runs
 * a single statement as one indivisible write, so simultaneous attempts can't overwrite each
 * other's counts. (A first version did "try UPDATE, else upsert", two statements: 20 parallel
 * attempts all saw "no row" and all reset the counter to 1, letting every one through.)
 */
export class PrismaRateLimitStore implements Store {
  /** Counters are shared through the database, not local to this process. */
  localKeys = false;
  private windowMs = 60_000;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(public prefix = 'rl:') {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
    // Delete expired counters periodically; unref() so this timer never keeps the process alive.
    this.cleanupTimer = setInterval(() => void this.deleteExpired(), Math.max(this.windowMs, 60_000));
    this.cleanupTimer.unref();
  }

  private id(key: string) {
    return this.prefix + key;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = BigInt(Date.now());
    const newResetAt = now + BigInt(this.windowMs);
    // New key → insert hits=1. Existing, still in its window → hits + 1.
    // Existing but expired → restart the window at hits=1. All decided inside one statement.
    // (Tagged-template $queryRaw sends these values as bound parameters, never as SQL text.)
    const [row] = await prisma.$queryRaw<CounterRow[]>`
      INSERT INTO "RateLimit" ("key", "hits", "resetAt") VALUES (${this.id(key)}, 1, ${newResetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "hits"    = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."hits" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN excluded."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "hits", "resetAt"`;
    if (!row) throw new Error('Rate limit counter was not returned');
    return toInfo(row);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const row = await prisma.rateLimit.findUnique({ where: { key: this.id(key) } });
    if (!row || row.resetAt <= BigInt(Date.now())) return undefined;
    return toInfo(row);
  }

  async decrement(key: string): Promise<void> {
    await prisma.rateLimit.updateMany({ where: { key: this.id(key), hits: { gt: 0 } }, data: { hits: { decrement: 1 } } });
  }

  async resetKey(key: string): Promise<void> {
    await prisma.rateLimit.deleteMany({ where: { key: this.id(key) } });
  }

  async resetAll(): Promise<void> {
    await prisma.rateLimit.deleteMany({ where: { key: { startsWith: this.prefix } } });
  }

  async deleteExpired(): Promise<number> {
    const { count } = await prisma.rateLimit.deleteMany({ where: { resetAt: { lte: BigInt(Date.now()) } } });
    return count;
  }

  shutdown(): void {
    clearInterval(this.cleanupTimer);
  }
}
