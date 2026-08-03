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

- **Business entity schema** (migration `business_entities`): `Client`,
  `ClientAddress`, `ServiceCategory`, `Service`, `Job`, `JobService`,
  `JobAssignment`, `StaffProfile`, `Invoice`, `InvoiceLineItem`, `Payment`,
  `AuditLog` — 12 tables, all carrying `organizationId` directly (including
  join tables like `job_services`, per the "no policy needs a JOIN"
  convention). RLS policies added for all 12; `audit_logs.organization_id`
  is nullable for system-level events, which the fail-closed policy makes
  invisible to every tenant connection by construction, not by extra code.
  - **Verified against the live Postgres instance**: seeded two orgs, each
    with a client and a job; confirmed Org A's `dos_app` connection sees
    only its own job/client counts, and — the trickier case — a
    cross-table subquery deliberately reaching for Org B's client id from
    within an Org-A-scoped connection returns zero rows rather than an
    error, i.e. the isolation holds through a join, not just direct id
    lookups.
  - Money fields use `Decimal(10,2)`, not float, throughout.

- **ERD** (`docs/erd/erd.md`): Mermaid entity-relationship diagram covering
  all 23 models. Cross-checked field-by-field against `schema.prisma`
  (grepped every model's fields and diffed by hand) to catch transcription
  errors before treating it as the review artifact for the "no invented
  fields" rule — no discrepancies found.

- **Tenant-context wiring** (`apps/api/src/prisma/`): implemented for
  real, not stubbed — `run-in-tenant-transaction.ts` (opens one Prisma
  interactive transaction per scoped operation, sets
  `app.current_org_id` via `set_config` so it can be parameter-bound
  instead of string-interpolated into SQL), `tenant-scoping.extension.ts`
  (Prisma Client Extension auto-injecting `organizationId` into
  reads/writes on the 15 tenant-scoped models), `ClsModule` +
  `TenantTransactionInterceptor` + `TenantContextService` (wraps every
  authenticated HTTP request in a transaction scoped to `req.user.org`,
  exposed to services via CLS).
  - **Verified against the live database**:
    `tenant-scoping.integration.spec.ts` seeds two real organizations and
    proves (a) an unfiltered `findMany` only returns the active org's
    rows, (b) a `create` whose caller hardcodes the _wrong_
    `organizationId` is rejected — not silently corrected — by Postgres
    RLS's `WITH CHECK`, (c) a direct id lookup into another org's row
    returns null, (d) a join-shaped filter reaching for another org's
    data returns zero rows. All 4 tests pass against Postgres 16.
  - Found and documented a real Prisma typing limitation along the way:
    Client Extensions change query _behavior_, not generated argument
    _types_, so `organizationId` is still required at compile time on
    every typed `create()` call regardless of the extension — the
    auto-injection's practical value is on the read/filter side (where
    args are optional) plus defense-in-depth for untyped call sites, not
    "omit the field entirely," which the original design sketch implied.
    Adjusted the extension's docstring and the test suite accordingly
    instead of leaving the documentation overstating what it does.
  - Live-booted the full app with this wired in
    (`ClsModule`/interceptor/health check all initialize correctly, and
    `@Public()` routes like `/health` correctly bypass the tenant
    transaction since they have no `req.user`).

- **Auth module** (`apps/api/src/modules/auth/`): implemented for real —
  `signup`, `login` (single and multi-membership branches),
  `select-organization`, `switch-organization`, `refresh` (rotation +
  reuse-family revocation), `logout` (idempotent), `me`, `verify-email`,
  `forgot-password`/`reset-password`, and the invitation flow
  (`organizations/me/invitations` create, public preview, accept with
  both the new-account and existing-account branches). `argon2id`
  password hashing, SHA-256 token hashing, `JwtAuthGuard` registered
  globally via `APP_GUARD`, `RolesGuard`/`PermissionsGuard` exported for
  other modules, `EmailService` stubbed to console logging per the
  original plan.
  - **Two more real bugs found by live end-to-end testing** (not by
    review): (1) `AuthService.me()`/`login()` crashed — Prisma's
    `include: { organization: true }` on an `organization_memberships`
    row fetched via the `app.current_user_id` bootstrap policy still hits
    `organizations`' own separate RLS policy, which wasn't satisfied;
    fixed with a fourth bootstrap policy, `bootstrap_by_membership`
    (`FOR SELECT`, subquery against `organization_memberships`) — see
    migration `auth_bootstrap_organization_visibility` and the updated
    ADR 0006. (2) `AuthService.refresh()`/`findValidInvitation()` had the
    identical bug shape one level deeper (`membership`/`organization`
    includes inside a `app.lookup_token_hash`-scoped lookup); fixed by
    refactoring both to a two-step pattern instead of a fifth bootstrap
    policy — fetch only the scalar row in the bootstrap context, then
    fetch related data through a normal `runInTenantTransaction` once the
    organization id is known. This two-step shape is now the documented
    default in ADR 0006; further bootstrap policies are the exception, not
    the pattern.
  - Also found and fixed: the refresh-token cookie was set with
    `secure: true` unconditionally, which real browsers silently drop
    over plain HTTP — local dev (`http://localhost`) always is. Now
    conditional on `NODE_ENV === 'production'`.
  - Also found and fixed: `POST /organizations/me/invitations` was fully
    implemented in `AuthService` but never wired to a controller route —
    caught immediately by testing the endpoint, not by lint/build/tsc
    (routing gaps like this don't show up as type errors).
  - **Full flow verified live** against the running API and a real
    PostgreSQL database (not mocked, not just unit-tested): signup →
    `/auth/me`; login → refresh (rotate) → reuse of the old token (401,
    family revoked) → the token that replaced it also 401; an
    owner-created invitation → public preview → accept as a new user →
    that user's `/auth/me`; a STAFF member blocked (403) from creating
    invitations; login with 2 memberships → `requiresOrganizationSelection`
    → select-organization → switch-organization → `/auth/me` reflecting
    the active org each time → switching to an org the user doesn't
    belong to (403); logout → refresh with the same token (401) → logout
    again (204, idempotent); forgot-password → reset-password → old
    password rejected, new password accepted.

- **Business module skeletons** (`apps/api/src/modules/{organizations,
memberships,users,roles,clients,services,jobs,staff,invoices,payments,
audit-logs}/`): controllers, DTOs (class-validator + Swagger), modules
  and stub services for all 11 remaining modules from the API contract in
  `docs/technical-log/phase-2.md`'s planning notes — 58 routes total.
  Every stub method throws `NotImplementedException` per the accepted
  Fase 2 pattern (root `CONTRIBUTING.md`); `RolesGuard`/`@Roles()` applied
  per the RBAC matrix where the route is Owner/Admin-only
  (`PATCH /organizations/me`, the memberships module, `/audit-logs`).
  - **`roles` is the one fully-implemented (non-stub) module** — `GET
/roles`/`GET /permissions` are plain reads of global, non-tenant
    reference data with no business logic to defer.
  - **Verified live**: booted the app and confirmed all 58 routes
    register (`RouterExplorer` log lines) matching the planned contract;
    confirmed `JwtAuthGuard` returns 401 on `/clients` and `/roles`
    without a token; confirmed an authenticated stub route
    (`GET /clients`) returns 501 (`NotImplementedException`) rather than
    erroring some other way; confirmed the real `/roles`/`/permissions`
    endpoints return 200 with the seeded data; confirmed
    `RolesGuard`/`@Roles(OWNER, ADMIN)` lets an Owner through to the
    stubbed `/audit-logs` (501, not 403) — proving the guard chain and
    the stub boundary compose correctly together.
  - `app.module.ts` now imports all 12 feature modules (11 stub + auth)
    alongside `PrismaModule`/`HealthModule`.

- **OpenAPI export**: `src/swagger.ts` factors the `DocumentBuilder`
  config out of `main.ts` so the live `/api/docs` and the exported file
  can never drift apart; `src/scripts/generate-openapi.ts` boots the full
  app, builds the document, and writes it to `docs/api/openapi.yaml` via
  `js-yaml`. `pnpm docs:api` now runs `nest build && node
dist/scripts/generate-openapi.js` — replaced the original bootstrap
  placeholder (`... || true`, silently swallowing failures) with a real
  implementation.
  - Found and fixed a fourth instance of the stale-`tsconfig.tsbuildinfo`
    bug first hit in the identity-schema step: this time a plain `tsc
--noEmit` typecheck (harmless on its own) left a buildinfo file that
    caused a _subsequent_ `nest build` to silently skip re-emitting most
    of `src/` — only the 2-3 files touched in this step came out, so
    `dist/app.module.js` and everything else were missing entirely and
    the generated script failed with `Cannot find module '../app.module'`.
    Root-caused and fixed for good this time by setting
    `incremental: false` in the shared `@dos/config/typescript/nest.json`
    base — the previous two times were treated as one-off local-dev
    annoyances; a third live occurrence made clear it needed a structural
    fix, not another manual `rm`.
  - **Verified**: generated `docs/api/openapi.yaml` has all 58 routes
    across 39 paths, all 13 controller tags, the `bearer` security scheme
    correctly applied to authenticated routes and correctly absent from
    `/health`.

- **apps/web scaffold** (`apps/web/`): Vite + React 18 + TypeScript SPA,
  Tailwind CSS with no component library (per the confirmed UI decision) —
  a routing + API-client scaffold, not finished screens (those are Fase 5).
  `src/api/client.ts` (typed `apiFetch` wrapper, in-memory-only access
  token per `docs/architecture/auth.md`, `credentials: 'include'` for the
  httpOnly refresh cookie), `src/context/AuthContext.tsx`
  (`AuthProvider`/`useAuth`, `login`/`logout`), `src/pages/{LoginPage,
DashboardPage}.tsx`, `src/App.tsx` (`RequireAuth` guard + `/login` and
  protected `/` routes).
  - Found and fixed two real bugs, both from the same root cause: the
    package's `"type": "module"` (needed for Vite's native ESM config)
    broke the two CJS tooling files that use `require`/`module.exports` —
    `eslint.config.js` and `postcss.config.js` both failed with "require is
    not defined in ES module scope". Fixed by renaming both to `.cjs`
    (ESLint's own documented fix for this exact conflict), including
    updating `eslint.config.cjs`'s self-referencing `files` glob to match
    the new names.
  - Found and fixed a third bug, this one in the shared config: linting
    `eslint.config.cjs` itself under `@dos/config/eslint/react.js` crashed
    with `TypeError: contextOrFilename.getFilename is not a function`
    inside the `react/display-name` rule. Root cause was
    `settings.react.version: 'detect'`, which auto-detects by resolving
    React from the linted file's own context — that breaks for non-React
    files like a config file linted under a ruleset that (deliberately)
    still applies to it. Fixed by pinning `settings.react.version` to
    `'18.3'` instead of `'detect'` in `packages/config/eslint/react.js`,
    with a comment explaining why pinning is required, not just stylistic.
  - **Verified**: `pnpm lint` (0 errors, 0 warnings after adding the
    missing JSDoc on every exported/local function), `npx tsc -b` clean,
    `vite build` produces a working `dist/` bundle, `node
scripts/check-readmes.mjs` passes from the repo root (15/15 modules), and
    a live `vite` dev server serves the app shell correctly at
    `http://localhost:5173` (confirmed via `curl`, correct `<title>` and
    root mount point).

_(Continued as later steps land — mobile scaffold, CI.)_
