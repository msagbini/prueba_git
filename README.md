# Digital Operations System (DOS)

DOS is a multi-tenant SaaS platform for managing the day-to-day operations of
service businesses — scheduling, staff, clients, invoicing and payments —
launching with cleaning services (residential, commercial, office,
construction cleaning, deep cleaning) and architected to extend to
maintenance, landscaping and general field services.

## Status

Currently in **Fase 2 — Base técnica**: this repository contains the
foundational architecture (database schema, API contract, authentication,
RBAC, monorepo structure) rather than finished product features. See
[`docs/technical-log/`](docs/technical-log/) for the phase-by-phase build
log and [`docs/architecture/overview.md`](docs/architecture/overview.md) for
the system design.

## Repository layout

```
apps/
  api/      NestJS backend (REST API, Prisma/PostgreSQL, multi-tenant)
  web/      React SPA — admin dashboard and client portal
  mobile/   React Native app — field staff mobile experience
packages/
  shared-types/   DTOs and enums shared across api/web/mobile
  config/         Shared ESLint, Prettier and TypeScript configuration
docs/
  architecture/   System design documents
  adr/            Architecture Decision Records
  erd/            Entity-relationship diagrams
  api/            Generated OpenAPI contract
  technical-log/  Per-phase build log
infra/
  docker/         Local development infrastructure (PostgreSQL)
```

## Getting started

Prerequisites: Node.js >= 20, [pnpm](https://pnpm.io) >= 9, Docker.

```bash
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d
pnpm --filter api prisma migrate dev
pnpm dev
```

See [`apps/api/README.md`](apps/api/README.md), [`apps/web/README.md`](apps/web/README.md)
and [`apps/mobile/README.md`](apps/mobile/README.md) for app-specific setup.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the development workflow,
documentation requirements, and the phase-approval process this product is
built under.
