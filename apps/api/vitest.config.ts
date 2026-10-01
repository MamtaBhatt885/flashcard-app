import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests live next to the code (src/**/*.test.ts); integration tests in test/*.int.test.ts.
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    // One SQLite file shared by all test files: run files one at a time to avoid write-lock contention.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters',
      CORS_ORIGIN: 'http://localhost:5173',
      AUTH_RATE_LIMIT_MAX: '1000',
      AUTH_RATE_LIMIT_WINDOW_MS: '60000',
    },
  },
});
