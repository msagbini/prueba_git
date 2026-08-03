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
```

## Fase 2 scope note

Per the product's build rules ("no code before architecture", see root
`CONTRIBUTING.md`), most `modules/*` in this Fase 2 snapshot expose their
contract (controllers, DTOs, Swagger docs) with service methods stubbed via
`NotImplementedException` — feature logic lands in Fase 3. The `auth`
module and the multi-tenant Prisma wiring are implemented for real in this
phase, since the rest of the system depends on them being solid.

## Scripts

- `pnpm dev` — start in watch mode.
- `pnpm build` / `pnpm start` — production build and run.
- `pnpm lint` / `pnpm test` — lint and test this app.
- `pnpm prisma:migrate` — create/apply a local migration.
- `pnpm prisma:seed` — seed system roles, permissions and industry
  verticals.
- `pnpm docs:api` — regenerate `../../docs/api/openapi.yaml` (requires a
  reachable database — it boots the full app to introspect routes, and
  `PrismaService` connects on startup).
