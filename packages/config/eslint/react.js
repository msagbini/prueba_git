const globals = require('globals');
const reactPlugin = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const base = require('./base');

/** ESLint flat config for React-based apps (apps/web, apps/mobile). Extends the shared base config. */
module.exports = [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    // eslint-plugin-react-hooks v5's recommended config declares its own
    // `plugins: ["react-hooks"]` array (legacy shape); flat config expects
    // an object of plugin instances instead, so the plugin is registered
    // above and only the rule set is merged in.
    settings: {
      // Pinned, not "detect": auto-detection calls into the linted
      // file's own resolution context, which throws when this config
      // also (deliberately) applies to non-component files in the same
      // app, e.g. eslint.config.cjs itself — see
      // docs/technical-log/phase-2.md.
      react: { version: '18.3' },
    },
  },
];
