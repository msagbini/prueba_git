# Changelog

All notable changes to this project are documented in this file. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — Fase 9.1: Optimización adicional

Stakeholder-directed follow-up to Fase 9 — further optimization "from
all aspects" plus closing functionality gaps Fase 9 had documented as
deliberately unbuilt (`docs/technical-log/phase-9.md` has the full log).

- **Web auth pages for email links**: `ForgotPasswordPage`,
  `ResetPasswordPage`, `VerifyEmailPage`, `AcceptInvitationPage` — the
  four pages `SmtpEmailService`'s real emails (shipped in Fase 9) link
  to, which didn't exist in `apps/web` until now. `AcceptInvitationPage`
  mirrors the API's exact authenticated-vs-new-account branching logic.
- **Database indices**: 12 new indices across `Job`, `ClientAddress`,
  `JobService`, `JobAttachment`, `JobAssignment`, `InvoiceLineItem`,
  `Payment`, `Client`, `Service`, `StaffProfile`, and `Invoice` —
  every FK "get children of X" lookup and paginated-list `orderBy`
  column previously had no supporting index beyond the tenant-scoping
  one.
- **Route-level code-splitting** (`apps/web`) via `React.lazy`: initial
  bundle down from 213.71 kB (64.04 kB gzip) to 173.89 kB (56.85 kB
  gzip), measured via `vite build`.
- **Invoice PDF export**: `GET /invoices/:id/pdf` (`InvoicePdfService`,
  `pdfkit`) renders a real, downloadable invoice PDF — organization,
  client and billing address, line items, and totals. `apps/web`'s
  Invoices page gained "PDF"/"Download PDF" buttons backed by a new
  `downloadFile()` client helper.
- **Client portal** (`apps/web`): the `Client` role has held RBAC
  permissions and row-level visibility onto its own jobs/invoices/
  payments since Fase 2, with no UI until now. Role-aware nav/dashboard
  (decoded from the access token's `role` claim) plus two new
  read-only pages, `MyJobsPage`/`MyInvoicesPage`, with PDF download.
  Along the way, fixed a real bug in `AcceptInvitationPage`: it set the
  access token without updating `AuthContext`'s React state, so
  `RequireAuth` bounced a freshly-accepted user straight back to
  `/login`.
- **Dispatch calendar**: `JobsPage` gains a List/Calendar toggle — a
  week view with native HTML5 drag-and-drop rescheduling (drop a job
  on another day, same `PATCH /jobs/:id` the edit form already uses).
  `GET /jobs` gained optional `scheduledFrom`/`scheduledTo` query
  params to support fetching one week at a time.

### Added — Fase 9: Hardening y funcionalidad operativa

Not part of the original 8-phase roadmap (that closed at Fase 8) —
stakeholder-directed follow-up work from a technical audit
(`docs/technical-log/phase-9.md` has the full log).

- **Operational web UI** — five real CRUD pages (`apps/web`) against
  APIs that had existed since Fase 3 with no UI in front of them:
  Clients (list/create/edit/addresses), Services (catalog), Staff
  (invite/edit), Jobs (list/create/edit/assign staff/bill services),
  Invoices (create/line items/record payments). A small shared
  component layer (`components/ui/`: Button, Field, Modal, Pagination).
- **Pagination** on every list endpoint (`clients`, `jobs`, `invoices`,
  `payments`, `staff`, `services`) — `?page=&pageSize=`, capped at 100.
- **Real transactional email** (`SmtpEmailService`, nodemailer),
  replacing the Fase 2 console-only stub whenever `SMTP_HOST` is
  configured.
- **Recurring job automation**: `Job.recurrenceRule` (stored since Fase
  2, never processed) now materializes real job instances daily via a
  new `RecurringJobsService`.
- **Job photo attachments**: upload/list/authenticated-download of
  photo evidence on a job, local disk storage.
- **Security hardening**: a stricter per-route rate limit on
  login/signup/forgot-password; a pnpm override fixing multer's
  high-severity DoS CVEs underneath `@nestjs/platform-express`.

### Added — Fase 8: Comercialización

- Real billing portal in `apps/web` (`pages/BillingPage.tsx`): current
  plan, Free/Pro/Business plan cards with limits, and a Stripe Checkout
  upgrade flow — consuming the `modules/billing` endpoints built in
  Fase 4, which had no UI consumer until now. Handles the checkout
  success/canceled redirect (`?checkout=success|canceled`) and the `503`
  no-Stripe-credentials-configured case inline.
- Session restore across page reloads (`context/AuthContext.tsx`): a
  silent `POST /auth/refresh` on app boot using the httpOnly refresh
  cookie — `apps/web` previously lost its session on every reload.
- Nested layout routing (`layouts/AppLayout.tsx`) with a Dashboard/
  Billing nav and sign-out, replacing the flat route shell from Fase 2.
- First test runner for `apps/web` (Vitest + `@testing-library/react`):
  10 tests across the API client, session restore, and billing page's
  formatting helpers.
- Fixed a preexisting `apps/mobile` build regression (`TS2786` across
  nearly every screen): `@react-native/typescript-config`'s `"jsx":
  "react-native"` (classic transform) is incompatible with
  `@types/react@19`'s module-scoped `JSX` namespace. Overrode to
  `"jsx": "react-jsx"` in `apps/mobile/tsconfig.json`, matching what
  `@react-native/babel-preset` already compiles to.

This closes the original 8-phase roadmap (Estrategia → Base técnica →
MVP operativo → Monetización → Expansión → App móvil → Escalabilidad →
Comercialización). See `docs/technical-log/phase-8.md` for the full log.

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
