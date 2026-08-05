const react = require('@dos/config/eslint/react');

/** ESLint flat config for apps/web — extends the shared React config. */
module.exports = [
  ...react,
  {
    files: ['vite.config.ts', 'tailwind.config.ts', 'postcss.config.cjs', 'eslint.config.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
