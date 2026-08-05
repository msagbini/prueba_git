const globals = require('globals');
const base = require('./packages/config/eslint/base');

/**
 * Root ESLint flat config. Lints root-level scripts and shared packages —
 * both plain Node.js tooling, hence CommonJS `require()` is allowed here
 * even though it's disallowed in the TypeScript app code under apps/*.
 * Each app under apps/* defines and lints against its own eslint.config.js
 * (via its own `lint` script), so this root config ignores apps/** to
 * avoid re-linting them with the wrong runtime globals.
 */
module.exports = [
  ...base,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // These are plain JS/CJS tooling files, not type-checked by tsc, so
      // JSDoc @param/@returns types carry real documentation value here
      // (unlike in the TypeScript app code, where the preset's assumption
      // that types are redundant with tsc holds).
      'jsdoc/no-types': 'off',
    },
  },
  { ignores: ['apps/**'] },
];
