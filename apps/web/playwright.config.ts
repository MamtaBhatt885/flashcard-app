import { defineConfig, devices } from '@playwright/test';

// E2E runs against its OWN servers and database, never your dev ones:
//   API  → http://localhost:4010 with apps/api/e2e.db (rebuilt from prisma/migrations each run)
//   Web  → http://localhost:5183 (Vite, proxying /api to 4010)
const API_PORT = 4010;
const WEB_PORT = 5183;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // one SQLite file: keep writes sequential
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Optional override for environments with a preinstalled browser; normally unset.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      cwd: '../api',
      command: 'node scripts/prepare-test-db.mjs e2e.db && npx tsx src/server.ts',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL: 'file:./e2e.db',
        JWT_SECRET: 'e2e-only-secret-that-is-at-least-32-characters',
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        AUTH_RATE_LIMIT_MAX: '1000',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
