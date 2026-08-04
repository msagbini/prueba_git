# Digital Operations System (DOS)

DOS is a multi-tenant SaaS platform for managing the day-to-day operations of
service businesses — scheduling, staff, clients, invoicing and payments —
launching with cleaning services (residential, commercial, office,
construction cleaning, deep cleaning) and architected to extend to
maintenance, landscaping and general field services.

## Status

**Fase 4 — Monetización: complete**, awaiting approval to start Fase 5
(Expansión). DOS now has tiered plans (Free/Pro/Business) with real
usage-limit enforcement, and a real Stripe Checkout/webhook integration
— unverified against Stripe's own servers pending real test credentials,
but with every other code path (validation, config-missing handling,
webhook signature verification) genuinely tested. The API's Fase 3
business modules (clients, services, staff, jobs/scheduling, invoicing,
payments) remain fully implemented — real CRUD, permission-scoped RBAC,
row-level visibility (Staff/Client), and an audit trail — behind the same
multi-tenant architecture built in Fase 2. The web and mobile apps are
still routing/navigation scaffolds; real screens land in Fase 6/7. See
[`docs/technical-log/phase-4.md`](docs/technical-log/phase-4.md) (and
[`phase-3.md`](docs/technical-log/phase-3.md),
[`phase-2.md`](docs/technical-log/phase-2.md) for prior phases) for the
full log, and
[`docs/architecture/overview.md`](docs/architecture/overview.md) for the
system design.

## Repository layout

```
apps/
  api/      NestJS backend (REST API, Prisma/PostgreSQL, multi-tenant)
  web/      React SPA — admin dashboard and client portal
  mobile/   React Native app — field staff mobile experience
packages/
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
