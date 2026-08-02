const globals = require('globals');
const base = require('./base');

/** ESLint flat config for Node.js backend apps (apps/api). Extends the shared base config. */
module.exports = [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
