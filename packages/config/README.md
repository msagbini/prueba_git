# @dos/config

Shared ESLint, Prettier and TypeScript configuration used by every app and
package in the DOS monorepo, so linting/formatting/compiler rules are
defined once and stay consistent.

## Contents

- `eslint/base.js` — base flat config (TypeScript + JSDoc enforcement +
  Prettier compatibility). JSDoc enforcement is how this repo's "every
  function is documented" rule is made CI-checkable rather than aspirational.
- `eslint/node.js` — base config + Node globals, used by `apps/api`.
- `eslint/react.js` — base config + React/React Hooks rules, used by
  `apps/web` and `apps/mobile`.
- `prettier.config.js` — shared formatting rules.
- `typescript/base.json`, `typescript/nest.json`, `typescript/react.json` —
  `tsconfig` bases for each runtime target.

## Usage

From an app's `eslint.config.js`:

```js
module.exports = require('@dos/config/eslint/node');
```

From an app's `tsconfig.json`:

```json
{ "extends": "@dos/config/typescript/nest.json" }
```
