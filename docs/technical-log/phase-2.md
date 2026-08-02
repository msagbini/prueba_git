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

- **apps/api bootstrap**: NestJS `main.ts`/`app.module.ts`, zod-validated
  `ConfigModule`, Swagger at `/api/docs`, public `/health`. Found and fixed
  a real monorepo tsconfig bug: `outDir`/`baseUrl` set in the shared
  `@dos/config/typescript` base files resolved relative to the _shared_
  config file's own location instead of the extending app — moved those to
  each app's own `tsconfig.json`. Verified with a live boot (`curl
/health`, `/api/docs`).
- **Local PostgreSQL**: `infra/docker/docker-compose.yml` +
  `init.sql`, implementing the two-role design (`dos_migrator`
  superuser/BYPASSRLS for migrations, `dos_app` restricted role for the
  API) from `docs/architecture/multi-tenancy.md`. Verified `init.sql`
  against a real Postgres 16 instance.
- **Prisma wiring**: `schema.prisma` (datasource `url` → `dos_app`,
  `directUrl` → `dos_migrator`), `PrismaService`/`PrismaModule`. Found and
  fixed a second real bug: the repo had no root `prettier.config.js`, so
  Prettier had silently been using its own defaults (double quotes)
  instead of the shared style on every file touched so far.
- **Identity & tenancy schema** (migration `identity_and_tenancy`):
  `Organization`, `IndustryVertical`, `User` (global identity, no
  `organizationId` — ADR 0005), `Role`/`Permission`/`RolePermission`,
  `OrganizationMembership`, `UserInvitation`, `RefreshToken`,
  `PasswordResetToken`, `EmailVerificationToken`. Hand-authored RLS
  policies added to the migration for every tenant-scoped table
  (`organizations` policied on its own `id`, since it has no separate
  `organization_id` column).
  - **Verified for real against a live Postgres 16 instance** (not just
    reviewed): migration applied cleanly; as `dos_app` with no
    `app.current_org_id` set, `SELECT` returns zero rows (fail-closed); as
    `dos_app` scoped to Org A, Org B's row is invisible to both `SELECT`
    and `UPDATE` (`WITH CHECK` blocks the write, affecting 0 rows) even
    when queried directly by id.
  - Seed script (`prisma/seed.ts`) populates the 5 system roles, 15
    permissions, the role→permission grants matching the RBAC matrix in
    `docs/architecture/auth.md`, and the 5 industry verticals — confirmed
    idempotent (re-run twice, same result) and confirmed readable through
    the restricted `dos_app` role.
  - Found and fixed a third bug along the way: `ts-node` can't resolve a
    multi-level relative `extends` chain through pnpm's symlinked
    `node_modules` (a known ts-node/pnpm interaction) — `tsc`/`nest build`
    resolve the same chain fine, only `ts-node` doesn't. Worked around
    with a small, deliberately non-extending `tsconfig.seed.json` used
    only by `pnpm prisma:seed`.

_(Continued as later steps land — business entity schema, ERD, auth
module, tenant-context wiring, business module skeletons, web/mobile
scaffolds, CI.)_
