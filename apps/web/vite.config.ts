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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts', 'src/vite-env.d.ts', 'src/main.tsx'],
      // Set at a small margin below the measured baseline (statements
      // 84.8%, branches 77.53%, functions 76.27%, lines 88.23% — see
      // docs/technical-log/phase-9.md) once the page/component test suite
      // closed the gap from an earlier ~6.5%, mirroring apps/api's
      // coverageThreshold pattern (jest.config.js).
      thresholds: {
        statements: 82,
        branches: 75,
        functions: 73,
        lines: 85,
      },
    },
  },
});
