const globals = require('globals');
const react = require('@dos/config/eslint/react');

/** ESLint flat config for apps/mobile — extends the shared React config. */
module.exports = [
  ...react,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    settings: {
      // React Native (0.86) requires React 19, unlike apps/web (React 18.3)
      // — override the shared config's pinned version for this app only.
      react: { version: '19.2' },
    },
  },
  {
    ignores: ['android/**', 'ios/**', 'dist/**'],
  },
  {
    files: [
      'eslint.config.js',
      'metro.config.js',
      'babel.config.js',
      'jest.config.js',
      'jest.setup.js',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Manual Jest mocks (__mocks__/*.js) and jest.setup.js are plain JS,
    // not type-checked — unlike .test.ts(x) files, which get `jest`/
    // `test`/`expect` as ambient globals from @types/jest, so `no-undef`
    // needs telling here.
    files: ['__mocks__/**/*.js', 'jest.setup.js'],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
];
