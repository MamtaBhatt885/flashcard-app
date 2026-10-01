// Runs once before all integration tests: a fresh test.db built from prisma/migrations.
// @ts-expect-error: plain .mjs script without type declarations
import { prepareTestDb } from '../scripts/prepare-test-db.mjs';

export default async function setup() {
  await prepareTestDb('test.db');
}
