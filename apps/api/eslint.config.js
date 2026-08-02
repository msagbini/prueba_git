const node = require("@dos/config/eslint/node");

/** ESLint flat config for apps/api — extends the shared Node config. */
module.exports = [
  ...node,
  {
    rules: {
      // Nest's DI pattern relies on empty constructors and decorator-only
      // classes that would otherwise trip up a couple of stylistic rules.
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
  {
    files: ["eslint.config.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];
