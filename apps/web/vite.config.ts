import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Load all vars (including non-VITE_ ones) for config use only; they are NOT exposed to the browser.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      proxy: {
        // Dev-only: same-origin /api calls, so no CORS and cookies just work.
        '/api': { target: env.API_PROXY_TARGET ?? 'http://localhost:4000', changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      // Vitest runs unit/component tests only; e2e/*.spec.ts belong to Playwright.
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
