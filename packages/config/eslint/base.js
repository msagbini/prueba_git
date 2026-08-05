const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const jsdoc = require('eslint-plugin-jsdoc');
const prettierConfig = require('eslint-config-prettier');

/**
 * Base ESLint flat config shared by every DOS app and package.
 *
 * Enforces the project's documentation rule ("every function is documented")
 * via eslint-plugin-jsdoc: any exported function/class must carry a JSDoc
 * comment with a description. This makes CONTRIBUTING.md's documentation
 * requirement a CI-checked rule instead of a convention.
 */
module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsdoc.configs['flat/recommended-typescript'],
  {
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
        },
      ],
      'jsdoc/require-description': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  prettierConfig,
  {
    ignores: ['dist/**', 'build/**', 'coverage/**', '.turbo/**', 'node_modules/**'],
  },
];
