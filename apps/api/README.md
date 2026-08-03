# @dos/api

The DOS backend API — NestJS, PostgreSQL via Prisma, multi-tenant with
Row-Level Security. See [`../../docs/architecture/overview.md`](../../docs/architecture/overview.md)
for how this fits into the rest of the system.

## Getting started

```bash
cp .env.example .env   # then fill in secrets
docker compose -f ../../infra/docker/docker-compose.yml up -d
pnpm prisma:migrate
pnpm dev
```

- API: http://localhost:3000
- Swagger UI: http://localhost:3000/api/docs
- Health check: http://localhost:3000/health

## Structure

```
src/
  main.ts              Bootstrap: global pipes, CORS, Swagger
  app.module.ts         Root module
  config/                Env validation (zod) + ConfigModule wiring
  common/                Cross-cutting guards, decorators, interceptors, filters
  prisma/                PrismaService + multi-tenant context wiring (see
                         ../../docs/architecture/multi-tenancy.md)
  health/                Liveness endpoint
  modules/               One folder per business/domain module (auth,
                         organizations, memberships, users, clients,
                         services, jobs, staff, invoices, payments,
                         audit-logs) — each has its own README.
prisma/
  schema.prisma          Database schema — the source of truth for every
                         table (see ../../docs/erd/)
  migrations/             Versioned SQL migrations, including hand-authored
                         RLS policies
  seed.ts                 Seeds system roles/permissions and industry
                         verticals
test/
  business-flows.e2e.spec.ts  Full-app e2e suite (supertest, real Postgres)
                               covering every business module together —
                               RBAC, row-level visibility, audit trail
```

## Status

All 11 business modules (`modules/*`) are implemented for real — see
[`../../docs/technical-log/phase-3.md`](../../docs/technical-log/phase-3.md)
for the build log. The `roles` module is read-only reference data with no
stub history; every other module has full CRUD-and-then-some behind its
Fase 2 contract (controllers, DTOs, Swagger docs), RBAC permission guards,
and — where the schema calls for it — row-level visibility, soft-delete/
deactivation, and audit logging.

## Scripts

- `pnpm dev` — start in watch mode.
- `pnpm build` / `pnpm start` — production build and run.
- `pnpm lint` / `pnpm test` — lint and test this app. `pnpm test` runs both
  `src/prisma/tenant-scoping.integration.spec.ts` (multi-tenant isolation)
  and `test/business-flows.e2e.spec.ts` (full business-flow e2e coverage)
  against a real Postgres database — set up `.env` and a running database
  first (see "Getting started" above), the same as running the app itself.
- `pnpm prisma:migrate` — create/apply a local migration.
- `pnpm prisma:seed` — seed system roles, permissions and industry
  verticals.
- `pnpm docs:api` — regenerate `../../docs/api/openapi.yaml` (requires a
  reachable database — it boots the full app to introspect routes, and
  `PrismaService` connects on startup).
