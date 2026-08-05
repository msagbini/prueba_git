# Architecture overview

## What DOS is

Digital Operations System (DOS) is a multi-tenant SaaS platform for
businesses that dispatch staff to do service work at client sites —
launching with cleaning services (residential, commercial, office,
construction cleaning, deep cleaning) and designed to extend to
maintenance, landscaping and general field services without a rewrite.

## System shape

```
┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
│  apps/web     │      │  apps/mobile │      │  Client portal    │
│  React SPA    │      │  React Native│      │  (part of web)    │
│  (staff/admin)│      │  (field staff)│      │                   │
└──────┬───────┘      └──────┬───────┘      └─────────┬─────────┘
       │  HTTPS / JSON REST, JWT bearer / cookie        │
       └───────────────────┬─────────────────────────────┘
                            ▼
                   ┌──────────────────┐
                   │     apps/api      │
                   │  NestJS backend   │
                   │  (modular)        │
                   └────────┬──────────┘
                            │ Prisma (per-request transaction,
                            │ SET LOCAL app.current_org_id)
                            ▼
                   ┌──────────────────┐
                   │   PostgreSQL      │
                   │  Row-Level        │
                   │  Security enabled │
                   └──────────────────┘
```

`apps/api`, `apps/web` and `apps/mobile` are independently deployable
applications sharing type contracts via `packages/shared-types` and tooling
via `packages/config`. See each app's own README for its internal
structure.

## Core architectural commitments

These hold across every phase of the roadmap, not just Fase 2:

1. **Multi-tenant by construction, not by convention.** See
   [`multi-tenancy.md`](./multi-tenancy.md). No endpoint or query is allowed
   to run without a resolved `organization_id`; this is enforced at both the
   application layer and the database layer (Postgres RLS), independently.
2. **A user is a global identity; access to an organization is a
   membership.** A person can belong to several organizations (e.g. a
   contractor who runs two businesses, or a future agency/white-label
   scenario) — see [`auth.md`](./auth.md) and
   [`docs/adr/0005-multi-org-membership.md`](../adr/0005-multi-org-membership.md).
3. **The API contract is the source of truth for client development.** Web
   and mobile are built against the committed OpenAPI spec
   (`docs/api/openapi.yaml`), not against the running server's current
   behavior.
4. **Industry vertical is configuration, not a fork.** `organizations` link
   to an `industry_verticals` row and carry a `settings` JSON column for
   vertical-specific configuration, rather than branching the codebase per
   industry.
5. **No feature code ships without its contract and schema being reviewed
   first.** See root `CONTRIBUTING.md`.

## Where to go next

- [`multi-tenancy.md`](./multi-tenancy.md) — the row-level isolation and RLS
  mechanism in detail.
- [`auth.md`](./auth.md) — authentication, sessions, and the
  multi-organization login flow.
- [`../erd/`](../erd/) — the full entity-relationship diagram.
- [`../api/openapi.yaml`](../api/openapi.yaml) — the generated API contract.
- [`../adr/`](../adr/) — why each major technical decision was made.
- [`../technical-log/`](../technical-log/) — what was actually built, phase
  by phase.
