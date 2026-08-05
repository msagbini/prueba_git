# Digital Operations System (DOS)

DOS is a multi-tenant SaaS platform for managing the day-to-day operations of
service businesses — scheduling, staff, clients, invoicing and payments —
launching with cleaning services (residential, commercial, office,
construction cleaning, deep cleaning) and architected to extend to
maintenance, landscaping and general field services.

## Status

**Fase 9 — Hardening y funcionalidad operativa: complete.** Not part of
the original 8-phase roadmap (that closed at Fase 8) — stakeholder-
directed follow-up from a technical audit of the whole product (design,
security, performance, missing functionality). `apps/web` now has real
operational screens for every business domain — Clients, Services,
Staff, Jobs, Invoices — not just Billing, closing the audit's top
finding (full APIs since Fase 3 with no UI in front of them). Also
shipped: pagination on every list endpoint, a real SMTP email provider
(replacing the Fase 2 console-only stub), daily recurring-job
materialization (`Job.recurrenceRule`, stored since Fase 2, was never
processed until now), job photo attachments (local disk storage,
authenticated download), a stricter per-route rate limit on
login/signup/forgot-password, and a dependency fix (pnpm override)
closing 4 of 6 high-severity multer CVEs the audit found. See
[`docs/technical-log/phase-9.md`](docs/technical-log/phase-9.md) for the
full log, including what's still deliberately unbuilt (client portal,
invoice PDFs, a dispatch calendar, mobile camera capture, and the
NestJS 11/react-router 7 migrations that would close the remaining
dependency vulnerabilities) and why.

Fase 8 closed the original 8-phase roadmap (Estrategia → Base técnica →
MVP operativo → Monetización → Expansión → App móvil → Escalabilidad →
Comercialización) with a real billing portal and session restore in
`apps/web`, and fixed a preexisting `apps/mobile` build regression along
the way. `apps/api` has a production Docker image (multi-stage, `pnpm
deploy`-based — see `apps/api/Dockerfile`), production hardening
(security headers, compression, per-IP rate limiting, graceful
shutdown, all live-verified), and a CI step that builds the image on
every push; this sandbox's egress policy blocks Docker Hub, so the
build itself remains unverified here. `apps/mobile` (Fase 6) has real
field-staff screens: sign in (multi-organization selection,
Keychain/Keystore session persistence), an assigned-jobs list, and a job
detail screen with clock in/out — still unverified against a real
device/simulator. `apps/api`'s Fase 5 reporting endpoints and Fase 4
monetization (tiered plans, Stripe Checkout/webhooks — unverified
against Stripe's own servers pending real test credentials) remain in
place. The Fase 3 business modules (clients, services, staff,
jobs/scheduling, invoicing, payments) remain fully implemented — real
CRUD, permission-scoped RBAC, row-level visibility, and an audit trail —
behind the same multi-tenant architecture built in Fase 2. See
[`docs/technical-log/phase-8.md`](docs/technical-log/phase-8.md),
[`phase-7.md`](docs/technical-log/phase-7.md),
[`phase-6.md`](docs/technical-log/phase-6.md),
[`phase-5.md`](docs/technical-log/phase-5.md),
[`phase-4.md`](docs/technical-log/phase-4.md),
[`phase-3.md`](docs/technical-log/phase-3.md),
[`phase-2.md`](docs/technical-log/phase-2.md) for prior phases, and
[`docs/architecture/overview.md`](docs/architecture/overview.md) for the
system design.

No further phase is defined anywhere in this project's own docs. Any
next direction (closing one of the items Fase 9 deliberately left open,
or something else) needs scope from the stakeholder, per the same
no-invented-scope rule already applied at each ambiguous phase.

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
