import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Vite config for the DOS web app — `defineConfig` from `vitest/config` (not plain `vite`) so the `test` block below type-checks. */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
