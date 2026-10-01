import { defineConfig } from 'prisma/config';

// Prisma 7 no longer auto-loads .env. Use Node's built-in loader for local dev,
// with no `dotenv` dependency. In CI and production the variables come from the
// platform, so a missing file is fine.
try {
  process.loadEnvFile('.env');
} catch {
  /* no .env file: rely on real environment variables */
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
