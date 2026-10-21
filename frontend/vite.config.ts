import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// In development the Vite dev server proxies /api to the main backend, so the browser only ever
// talks to the TenderLens API (never to PostgreSQL or future internal services).
const apiTarget = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
  preview: { port: 4173, proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'], css: false, testTimeout: 15000 },
});
