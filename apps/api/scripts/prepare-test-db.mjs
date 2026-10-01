/**
 * Builds a fresh SQLite database from the real migration files in prisma/migrations.
 * Used by the Vitest integration tests (test.db) and the Playwright E2E server (e2e.db),
 * so tests always run against exactly the schema your migrations produce.
 *
 *   node scripts/prepare-test-db.mjs e2e.db
 */
import { createClient } from '@libsql/client';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = resolve(apiDir, 'prisma/migrations');

export async function prepareTestDb(fileName) {
  const file = resolve(apiDir, fileName);
  for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(file + suffix, { force: true });

  if (!existsSync(migrationsDir)) {
    throw new Error('No prisma/migrations folder. Run `npm run db:migrate -w apps/api` once first.');
  }
  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(); // Prisma names migrations with a timestamp prefix, so sorted = applied order

  const db = createClient({ url: `file:${file}` });
  for (const name of migrations) {
    await db.executeMultiple(readFileSync(resolve(migrationsDir, name, 'migration.sql'), 'utf8'));
  }
  db.close();
  return { file, migrations };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { file, migrations } = await prepareTestDb(process.argv[2] ?? 'test.db');
  console.log(`Prepared ${file} from ${migrations.length} migration(s)`);
}
