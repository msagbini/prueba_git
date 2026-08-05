/** Jest config for apps/api. Loads .env so integration tests (see src/prisma/*.integration.spec.ts) can reach a local database. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  setupFiles: ['dotenv/config', '<rootDir>/test/silence-logs.setup.ts'],
};
