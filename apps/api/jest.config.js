/**
 * Jest config for apps/api. Loads .env so integration tests (see
 * src/prisma/*.integration.spec.ts) can reach a local database.
 *
 * Coverage thresholds are a regression guard, not an aspirational
 * target: they're set at the real measured baseline (`pnpm run
 * test:coverage`, 2026-08 — statements 80.7%, lines 79.3%, functions
 * 67.7%, branches 48.9%), rounded down a few points for headroom, not
 * invented. Branches/functions sit well below statements/lines mostly
 * because of defensive `catch` blocks and rarely-hit guard clauses in
 * services — see docs/technical-log/phase-9.md for the full context.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  setupFiles: ['dotenv/config', '<rootDir>/test/silence-logs.setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts'],
  coverageThreshold: {
    global: {
      statements: 78,
      lines: 77,
      functions: 65,
      branches: 46,
    },
  },
};
