# Changelog

All notable changes to this project are documented in this file. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — Fase 7: Escalabilidad

- Production Docker image for `apps/api` (`apps/api/Dockerfile`,
  multi-stage, `pnpm deploy`-based) and a matching `.dockerignore`.
  Resolves the argon2-native-bindings-against-the-deploy-image open
  item flagged in `docs/architecture/auth.md`: a real hash/verify round
  trip was run directly against the deployed package's installed
  argon2 module.
- Production hardening for `apps/api`: `helmet` (security headers),
  `compression`, per-IP rate limiting (`@nestjs/throttler`, 100
  req/60s), and `app.enableShutdownHooks()` so the database connection
  closes cleanly on `SIGTERM` instead of the process dying mid-request.
- CI now builds the production Docker image on every push (no registry
  push yet — no deploy target has been decided).

This sandbox's egress policy blocks Docker Hub, so `docker build`
itself could not be run here — see `docs/technical-log/phase-7.md` for
exactly what was and wasn't verified, and how.

### Added — Fase 6: App móvil

- Real field-staff screens for `apps/mobile` (React Native bare): sign
  in (with multi-organization selection), a list of the caller's
  assigned jobs, and a job detail screen with client/address/services
  and "Start job"/"Complete job" (clock in/out) actions.
- Session persistence via `react-native-keychain` (iOS Keychain /
  Android Keystore), per the mobile token-storage design in
  `docs/architecture/auth.md` — session restore on launch rotates the
  stored refresh token rather than trusting a possibly-expired access
  token.
- `apps/api`: `GET /jobs`/`GET /jobs/:id` now embed client contact
  info, the service address, and billed services (Staff holds
  `jobs.read` but not `clients.read`/`services.read`, so this was the
  only way a Staff caller could learn who a job is for or where to
  go). New `POST /jobs/:id/start`/`/complete` let the job's assigned
  Staff member (or Owner/Admin/Dispatcher) transition it through
  `IN_PROGRESS`/`COMPLETED` without needing the broader `jobs.manage`
  permission.
- Jest test infrastructure for `apps/mobile` (manual mocks for
  `react-native-keychain` and `react-native-safe-area-context`, needed
  since neither has a native module under Jest).

This container has no Android SDK or Xcode — native builds and the
real Keychain/Keystore round trip are unverified pending a real
device/simulator; see `docs/technical-log/phase-6.md` for exactly
what is and isn't confirmed.

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
