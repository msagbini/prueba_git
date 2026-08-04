# Digital Operations System (DOS)

DOS is a multi-tenant SaaS platform for managing the day-to-day operations of
service businesses — scheduling, staff, clients, invoicing and payments —
launching with cleaning services (residential, commercial, office,
construction cleaning, deep cleaning) and architected to extend to
maintenance, landscaping and general field services.

## Status

**Fase 7 — Escalabilidad: complete**, awaiting approval to start Fase 8.
`apps/api` now has a production Docker image (multi-stage, `pnpm
deploy`-based — see `apps/api/Dockerfile`), production hardening
(security headers, compression, per-IP rate limiting, graceful
shutdown, all live-verified), and a CI step that builds the image on
every push. This sandbox's egress policy blocks Docker Hub, so the
build itself is unverified here (its core mechanism and its one
genuinely uncertain native dependency, argon2, were verified directly
without Docker) — see `docs/technical-log/phase-7.md` for exactly what
is and isn't confirmed. `apps/mobile` (Fase 6) has real field-staff
screens: sign in (multi-organization selection, Keychain/Keystore
session persistence), an assigned-jobs list, and a job detail screen
with clock in/out — still unverified against a real device/simulator.
`apps/api`'s Fase 5 reporting endpoints and Fase 4 monetization (tiered
plans, Stripe Checkout/webhooks — the latter unverified against
Stripe's own servers pending real test credentials) remain in place.
The Fase 3 business modules (clients, services, staff, jobs/scheduling,
invoicing, payments) remain fully implemented — real CRUD,
permission-scoped RBAC, row-level visibility, and an audit trail —
behind the same multi-tenant architecture built in Fase 2. `apps/web`
is still a routing/navigation scaffold. See
[`docs/technical-log/phase-7.md`](docs/technical-log/phase-7.md) (and
[`phase-6.md`](docs/technical-log/phase-6.md),
[`phase-5.md`](docs/technical-log/phase-5.md),
[`phase-4.md`](docs/technical-log/phase-4.md),
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
