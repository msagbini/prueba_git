# Changelog

All notable changes to this project are documented in this file. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — Fase 9.1: Optimización adicional

Stakeholder-directed follow-up to Fase 9 — further optimization "from
all aspects" plus closing functionality gaps Fase 9 had documented as
deliberately unbuilt (`docs/technical-log/phase-9.md` has the full log).

- **Observability**: previously, an unhandled exception in production was
  invisible — the default console logger and no error tracking. Added
  structured JSON logging (`nestjs-pino`, credentials/tokens redacted,
  `/health` excluded from access logs) app-wide; an `ErrorReportingService`
  port (`modules/observability/`) bound to a real `SentryErrorReportingService`
  when `SENTRY_DSN` is set, or a warn-once no-op otherwise — same
  degradation pattern and honesty standard as `EmailService`/Stripe (no
  real Sentry account in this project, so delivery is unverified, only
  that the correct implementation binds); a global `AllExceptionsFilter`
  that logs/reports every exception while delegating the actual HTTP
  response to `BaseExceptionFilter.catch()` unchanged; process-level
  `uncaughtException`/`unhandledRejection` handlers. Found while verifying
  this live (killed Postgres before boot): registering the
  `unhandledRejection` handler suppresses Node's default
  terminate-on-unhandled-rejection behavior, so a boot failure left a
  zombie process instead of exiting — fixed with an explicit `.catch()`
  on the `bootstrap()` call itself. Also added `apps/web`'s first
  `ErrorBoundary` (a render error used to blank the whole page); a
  browser-side Sentry SDK is explicitly out of scope for this pass.
  Verified live against the running API: a forced 404 logged a warning
  with no report, a forced 500 logged an error with a redacted
  `Authorization` header and a single (not per-request) "Sentry not
  configured" warning, and the client-facing response body stayed
  exactly `{"statusCode":500,"message":"Internal server error"}` — no
  stack-trace leak, same as Nest's original default.
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
- **Mobile client portal**: `apps/mobile` was Staff-only since Fase 6;
  it now has a second, role-gated navigation stack for `CLIENT`
  callers — `ClientHomeScreen`, `MyJobsScreen`, `MyInvoicesScreen`,
  `MyInvoiceDetailScreen`, all read-only, mirroring `apps/web`'s
  client portal. No PDF download on mobile (documented gap — needs a
  file-saving library this bare RN app doesn't have, unverifiable
  without a device).
- **Notifications**: a new `Notification` model surfaces two existing
  events as in-app notifications rather than inventing a new business
  process — a staff member being assigned to a job, and a job
  starting within 24 hours (a new hourly `JobRemindersService`, also
  notifying any client-portal user linked to the job's client). No
  email/push delivery. `GET /notifications`, `GET /notifications/
  unread-count`, `POST /notifications/:id/read`, all scoped to the
  caller's own notifications. `apps/web` gets a `NotificationBell` in
  the nav bar (unread badge, dropdown, mark-as-read); `apps/mobile`
  gets a matching `NotificationsButton` (badge, header, both the Staff
  and Client stacks) and a `NotificationsScreen`.

### Changed — Fase 9.1

- **`react-router-dom` 6→7**: `apps/web` used only declarative routing
  (no data router, no splat routes), which v7 was designed to accept
  as-is — no code changes needed. Resolves 2 of the pre-existing
  dependency vulnerabilities (`GHSA-jjmj-jmhj-qwj2`, unpatched in the
  6.x line; `GHSA-337j-9hxr-rhxg`, patched in 7.18.0+):
  `pnpm audit --prod` goes from 15 to 13. Verified live with
  Playwright: all nav links, dashboard shortcuts, browser back/
  forward, logout, and protected/public route guarding.

- **Dependency vulnerabilities, second pass**: `pnpm audit --prod`
  found 13 vulnerabilities, mostly in transitive dependencies pinned
  to an exact, older version inside `@nestjs/config`,
  `@nestjs/swagger`, `@nestjs/common`, and `@nestjs/platform-express`
  — not fixable with a plain `pnpm update`. Added `pnpm.overrides`
  (keyed to the specific vulnerable version, not the bare package
  name, so unrelated resolutions of the same package elsewhere in the
  tree are untouched) forcing patch/minor bumps: `lodash` 4.17.21 →
  4.18.1, `js-yaml` 4.1.0 → 4.3.1, `file-type` 20.4.1 → 21.3.2, `qs`
  6.14.2 → 6.15.3, `body-parser` 1.20.4 → 1.20.6, `multer` 2.0.2 →
  2.2.0. `multer` (four DoS CVEs) is the one with real attack surface
  in this app — it's the library handling job-attachment photo
  uploads — so it got targeted verification beyond "it's a minor
  bump": `test/job-attachments.e2e.spec.ts` stayed green. `pnpm audit
  --prod` goes from 13 to 3. The remaining 3 each need a major-version
  migration deliberately left out of this pass: `@nestjs/core` (needs
  11.1.18+, the still-pending Nest 10→11 migration),
  `react-router` (needs 8.3.0+, a newly-found 7→8 migration beyond
  the 6→7 one above), and `fast-xml-parser` (needs 5.7.0+, buried
  inside React Native's own Android CLI build tooling — unverifiable
  without a device/emulator in this environment).
- **`react-router` 7→8** (`apps/web`): turned out not to be an
  isolated router bump — v8's peer deps require React `>=19.2.7` and
  Node `>=22.22.0`, and the separate `react-router-dom` package was
  discontinued in favor of a unified `react-router` package. Surfaced
  this to the stakeholder before starting, since it changed the risk
  profile from "router bump" to "three chained major migrations";
  got explicit go-ahead to do all three in one pass. Bumped React
  18.3.1 → 19.2.8, Vite 5.4.8 → 7.3.6, `react-router-dom` 7.18.2 →
  `react-router` 8.3.0 (plus `@vitejs/plugin-react`, `vitest`,
  `@vitest/coverage-v8`, `@types/react(-dom)` to their Vite-7/React-19
  -compatible majors). Only real code change: `@types/react` 19
  removed the global `JSX` namespace, so the 24 files annotating
  `: JSX.Element` return types needed an explicit `import type {
  JSX } from 'react'` — mechanical, no behavior change. The 10
  `react-router-dom` imports became `react-router` (confirmed first
  that every API this app uses — `BrowserRouter`, `Route`, `Routes`,
  `Link`, `NavLink`, `useNavigate`, `useSearchParams`, `useParams` —
  ships from the main package, not the data-router-only `react-router
  /dom` sub-path). Bundle grew 195.77 kB → 244.39 kB gzip (64.13 kB →
  78.45 kB) — the larger React 19 runtime plus router 8's new
  `cookie-es` dependency; accepted as the cost of staying current and
  vulnerability-free. `pnpm audit --prod` goes from 3 to 2. Verified
  live with Playwright using realistic click-based navigation: all
  nav links, dashboard shortcuts, browser back/forward, logout,
  protected/public route guarding — clean. Re-running the legacy
  6→7-migration verification script (which chains several full-page
  `goto()` reloads back-to-back) reproduced the already-documented
  refresh-token race below in its original form — confirmed it's
  still there and untouched, not something this migration introduced.
- **NestJS 10→11** (`apps/api`): the last big migration deliberately
  deferred since Fase 9's original close-out. Investigated the real
  breaking-change surface against this codebase before touching
  anything, same method as the router migrations above: audited
  every `@Controller`/`@Get`/`@Post`/`@Patch`/`@Delete` decorator
  (none use wildcard or optional-param routes — Express 5's stricter
  `path-to-regexp` v8 was the headline risk, and this app never used
  the syntax it dropped) and every `app.use()` call (only
  version-agnostic middleware). Real finding: `nestjs-cls`
  (`AsyncLocalStorage`-based tenant context — the core multi-tenancy
  mechanism) was pinned to a version whose own peer deps cap out
  below Nest 11; bumped 4.4.1 → 6.2.1 after confirming its `.d.ts`
  keeps the exact `ClsModule.forRoot`/`ClsService.get`/`.set` surface
  this app depends on. Bumped all `@nestjs/*` packages to their 11.x
  majors; `multer`/`@types/multer` (already 2.2.0 from the earlier
  security pass) turned out to already match what
  `@nestjs/platform-express@11` ships. Result: clean install, zero
  peer-dep warnings, zero TypeScript errors, zero application code
  changes — only `package.json`. Found a fresh, unrelated `js-yaml`
  vulnerability pulled in by the new `@nestjs/swagger@11` (patched
  via the same targeted-override pattern; the old, now-unmatched
  `js-yaml@4.1.0` override was removed as dead config). `pnpm audit
  --prod` goes from 2 to 1 — resolves the last `apps/api`
  vulnerability, leaving only the deferred `fast-xml-parser` one.
  Regenerated OpenAPI doc is byte-identical in content (only a
  cosmetic key-reordering diff). **Verified live against the running
  server** with Express 5 confirmed in the actual dependency tree:
  full CRUD with path params and a nested route, a real two-
  organization cross-tenant isolation check (org B gets a 404, not
  org A's data, and an empty list of its own), invoice PDF
  generation, job-attachment photo upload, the Stripe webhook's raw-
  body handling, forced 404/500s exercising the observability
  wiring from the addendum above, and the Swagger UI — all unchanged.

### Fixed — Fase 9.1

- **Refresh-token rotation race (false logout on page load)**: found
  while live-verifying the react-router migration above. Root cause:
  React `StrictMode`'s dev-mode double-invoke of `AuthContext`'s
  mount effect fired two concurrent `POST /auth/refresh` calls
  sharing one not-yet-rotated cookie/token; the server correctly
  treated the second as reuse of an already-rotated token (ADR 0004's
  theft-detection defense) and revoked the whole token family,
  silently logging out a freshly-loaded page. Fixed with a `useRef`
  mount guard in `AuthContext` (`apps/web` and, preventively,
  `apps/mobile`) that survives `StrictMode`'s simulated remount and
  limits session restoration to one call per real mount — no change
  to the server's rotation/reuse-detection logic. Added a regression
  test rendering `AuthProvider` under `<StrictMode>` and asserting
  exactly one `/auth/refresh` call; confirmed it fails without the
  fix and passes with it. Verified live against the dev server with
  Playwright (2 calls → 1 per page load).
  - **Known remaining gap, deliberately out of scope**: a narrower,
    distinct race is still reproducible with full-page reloads
    (`goto()`) in very rapid succession — faster than any real user
    interaction — where a new load can race the browser's receipt of
    the previous rotation's `Set-Cookie`. Fixing that would require
    changing the server's security-sensitive reuse-detection logic
    (Fase 2), which is out of scope for this client-side fix.

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
