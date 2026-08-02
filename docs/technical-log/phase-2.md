# Fase 2 — Base técnica: technical log

Status: **in progress**

Tracks what was actually built during Fase 2, in the order it happened, so
decisions have a paper trail independent of the ADRs (which capture _why_;
this captures _what and when_).

## Planning

- Fase 1 (product strategy) presented and approved.
- Fase 2 scope, stack decisions (NestJS + separate React SPA, PostgreSQL
  with a self-built auth stack, React Native **bare**, pnpm + Turborepo,
  Prisma, Tailwind without a component library) and the multi-organization
  membership model (ADR 0005) confirmed with the product stakeholder before
  any code was written.
- Detailed implementation plan reviewed and approved
  (`/root/.claude/plans/quiet-frolicking-possum.md` at planning time).

## Build log

- **Root scaffolding**: pnpm workspaces + Turborepo, root `package.json`,
  `tsconfig.base.json`, `.gitignore`, `README.md`/`CONTRIBUTING.md`/
  `CHANGELOG.md`. Removed the unrelated `archivo_prueba.py` placeholder
  file the repository started with.
- **Shared tooling** (`packages/config`): ESLint flat configs (base/node/
  react) with `eslint-plugin-jsdoc` enforcing the documentation rule from
  `CONTRIBUTING.md`, shared Prettier config, shared `tsconfig` bases.
  Husky `pre-commit` (lint-staged) and `commit-msg` (commitlint,
  Conventional Commits) hooks wired and verified working end-to-end.
  `scripts/check-readmes.mjs` added as the CI-checkable version of "every
  module has a README."
- **Docs skeleton**: `docs/architecture/{overview,multi-tenancy,auth}.md`,
  ADRs 0001–0005, `docs/erd/`, `docs/api/`, this log.

_(Continued as later steps land — API bootstrap, Prisma schema, RLS,
auth module, business module skeletons, web/mobile scaffolds, CI.)_
