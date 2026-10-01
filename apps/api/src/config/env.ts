import { z } from 'zod';

/**
 * Single source of truth for runtime configuration.
 * Nothing else in the API reads process.env directly.
 * Invalid or missing values stop the process at boot, not on the first request.
 */
const csv = z
  .string()
  .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_QUERIES: z.stringbool().default(false),

  // SQLite file, e.g. file:./dev.db (relative to apps/api)
  DATABASE_URL: z.string().startsWith('file:', 'DATABASE_URL must look like file:./dev.db'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  COOKIE_DOMAIN: z.string().optional(),

  // Comma-separated list of allowed browser origins, e.g. "https://app.example.com"
  CORS_ORIGIN: csv,
  // Number of reverse proxies in front of the API (needed for correct client IPs in rate limiting)
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
