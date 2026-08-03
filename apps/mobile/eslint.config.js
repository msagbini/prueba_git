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
    files: ['eslint.config.js', 'metro.config.js', 'babel.config.js', 'jest.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
