# Changelog

All notable changes to this project are documented in this file. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — Fase 5: Expansión (Reportes y Analytics)

- Five read-only report endpoints (`modules/reports`), gated by a new
  `reports.read` permission (Owner/Admin only): `GET /reports/revenue`
  (total + time-bucketed), `GET /reports/jobs-summary` (counts by
  status), `GET /reports/staff-performance` (jobs completed + hours
  worked per staff member), `GET /reports/top-clients` (highest-revenue
  clients), and `GET /reports/outstanding-invoices` (current unpaid
  balance, total and overdue). No new schema — every report reads
  existing `Payment`/`Job`/`Invoice`/`StaffProfile` data.
- `PATCH /jobs/:id` now accepts `actualStart`/`actualEnd` — these
  existed in the schema since Fase 2 but had no endpoint to set them
  until the staff-performance report needed them.
- e2e coverage for all five reports against a real fixture, plus a 403
  check for non-Owner/Admin callers.

See `docs/technical-log/phase-5.md` for the full build log.

### Added — Fase 4: Monetización

- Tiered plans (Free/Pro/Business): `Plan` (global reference data) and
  `Subscription` (tenant-scoped, 1:1 with `Organization`, RLS-protected)
  schema, seeded with concrete prices and usage limits. Every
  organization starts on Free at signup.
- `GET /plans` and `GET /organizations/me/subscription` read endpoints.
- Plan-limit enforcement (`modules/billing`): `maxClients`/
  `maxActiveJobs`/`maxStaff` are checked before client creation, job
  creation, Staff invitation acceptance, and promotion to Staff,
  responding `402 Payment Required` when exceeded.
- Stripe Checkout (`POST /organizations/me/subscription/checkout`,
  Owner/Admin only) against the real `stripe` SDK — creates/reuses a
  Stripe Customer and starts a subscription Checkout Session.
- Stripe webhook handler (`POST /webhooks/stripe`) verifying
  `Stripe-Signature` and syncing `Subscription` state on
  `checkout.session.completed`/`customer.subscription.updated`/
  `customer.subscription.deleted`.
- e2e coverage (`apps/api/test/business-flows.e2e.spec.ts`) for plan
  limits, checkout's verifiable-without-Stripe-credentials branches, and
  a full offline round trip of the webhook handler using
  `stripe.webhooks.generateTestHeaderString` against a locally-generated
  secret.

This project has not yet been given real Stripe credentials — see
`docs/technical-log/phase-4.md` for exactly what is and isn't
live-verified end-to-end.

### Added — Fase 3: MVP operativo

- Real implementations for all 11 business modules (organizations,
  memberships, users, clients, services, staff, jobs, invoices, payments,
  audit logs), replacing the Fase 2 `NotImplementedException` stubs.
- Fine-grained `clients.manage`/`clients.read`-style permission guards on
  every business route, on top of the RBAC matrix seeded in Fase 2.
- Row-level visibility: Staff callers see only jobs they're assigned to;
  Client callers see only their own jobs, invoices and payments.
- Automatic invoice numbering, derived invoice totals from line items,
  and automatic invoice-to-PAID transition once payments cover the total.
- An audit trail: every mutation across the business modules records a
  before/after entry, readable via `GET /audit-logs`.
- A `UserInvitation.clientId` link (migration
  `invitation_client_link`) so a Client-role invitation attaches the
  resulting membership to the right `Client` record.

See `docs/technical-log/phase-3.md` for the detailed build log,
including the real bugs found and fixed along the way.

### Added — Fase 2: Base técnica

- Monorepo scaffolding (pnpm workspaces + Turborepo).
- Shared ESLint/Prettier/TypeScript configuration with enforced JSDoc rules.
- Architecture documentation, ADRs and ERD.
- NestJS API scaffold with health check and Swagger.
- PostgreSQL schema (Prisma) covering identity, tenancy and core business
  entities, with Row-Level Security multi-tenant isolation.
- Custom authentication (signup, login, refresh rotation, multi-organization
  switching, invitations) and RBAC guards.
- Business module contract skeletons (organizations, memberships, users,
  clients, services, jobs, staff, invoices, payments, audit logs).
- React SPA scaffold (`apps/web`) and React Native scaffold (`apps/mobile`).
- CI pipeline (lint, build, test, documentation check).

See `docs/technical-log/phase-2.md` for the detailed build log of this phase.
