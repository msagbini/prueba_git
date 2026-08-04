# Fase 4 — Monetización: technical log

Status: **Fase 4 completa — esperando aprobación para Fase 5**

Tracks what was actually built during Fase 4. Scope, per the product's own
rules: DOS's own billing relationship with an organization — tiered plans
(Free/Pro/Business), usage-limit enforcement, and Stripe Checkout/webhooks
— distinct from `modules/invoices`/`modules/payments` (Fase 3), which are
the cleaning business's own billing to _its_ customers and are untouched
by this phase.

## Planning

- User authorization for this phase was broader than a simple "proceed":
  _"Dale todo enseguida. Tú eres el pro. No tienes necesariamente que
  avanzar cuando yo te lo indique, avanza si previamente ya doble
  chequeaste y testeaste todo, si analizaste nuevamente para decir que
  añadir, que quitar, cómo optimizarlo, etc."_ — full autonomy to proceed
  without a per-step approval gate, conditioned on genuine self-review and
  testing before each step, not on skipping them.
- Acting on that authorization, a review pass on the just-closed Fase 3
  found a real gap (no automated regression tests — only manual `curl`
  verification) and fixed it first: `apps/api/test/business-flows.e2e.spec.ts`,
  a Supertest suite against a fully-booted app and a real Postgres
  database, covering everything Fase 3's manual testing had covered plus
  cross-org isolation. This became the harness every Fase 4 feature was
  verified against, in addition to live `curl`.
- Two genuinely blocking unknowns — not things a "no invented fields"
  product should guess at — were resolved via `AskUserQuestion` before
  writing any Fase 4 code:
  - Monetization model: **planes por tier (Free/Pro/Business)**, the
    classic SaaS shape, over usage-based or a single paid tier.
  - Stripe test credentials: **not available yet**. Decision: build the
    real integration against the actual `stripe` SDK, but design every
    Stripe-dependent code path so its non-network-dependent behavior
    (validation, config-missing handling, signature verification) is
    still genuinely testable without a real account, and document
    precisely what remains unverified pending real keys — rather than
    mocking Stripe or deferring the whole feature.

## Build log

- **Schema — `Plan` and `Subscription`**
  (`prisma/schema.prisma`, migration
  `20260803110206_monetization_plans_subscriptions`): `Plan` is global
  reference data (no `organizationId`, alongside `User`/`Role`/
  `IndustryVertical`/etc.) — every organization picks one, not owns one,
  same shape as `IndustryVertical`. `maxClients`/`maxActiveJobs`/
  `maxStaff` are nullable Ints (`null` = unlimited, used by Business).
  `Subscription` is tenant-scoped and 1:1 with `Organization`
  (`organizationId @unique`), carrying `planId`, `status`
  (`ACTIVE`/`TRIALING`/`PAST_DUE`/`CANCELED`), and nullable
  `stripeCustomerId`/`stripeSubscriptionId`/`currentPeriodEnd` — null
  until an organization completes Stripe Checkout. RLS policy added by
  hand in the migration (Prisma doesn't generate it), same
  fail-closed `tenant_isolation` shape as every other tenant table.
  Added to `TENANT_SCOPED_MODELS`.
  - **Live-verified the RLS policy directly against Postgres** (not just
    trusted the copy-pasted SQL): with no `app.current_org_id` set,
    `SELECT` returns zero rows (fail-closed); scoped to org A, exactly
    org A's subscription is visible; a direct id lookup for org B's
    subscription while scoped to org A returns zero rows. Test data
    cleaned up after.
  - `prisma/seed.ts` upserts the three plans with concrete prices/limits
    (Free: $0, 10 clients/20 active jobs/2 staff; Pro: $49/mo, 100/500/10;
    Business: $149/mo, unlimited).

- **Read endpoints** (`modules/plans`, `GET /organizations/me/subscription`
  in `modules/billing`): `GET /plans` lists all plans ordered by price,
  mirroring the existing `modules/roles` pattern (plain `PrismaService`,
  global reference data, no tenant scoping needed). The subscription
  endpoint returns the caller's subscription joined with its plan.

- **Plan-limit enforcement** (`modules/billing/billing.service.ts`,
  `plan-limit-exceeded.exception.ts`): `assertClientLimit`/
  `assertActiveJobLimit`/`assertStaffLimit`, wired into
  `ClientsService.create`, `JobsService.create`,
  `AuthService.acceptInvitation` (Staff invitations), and
  `MembershipsService.update` (promotion to Staff). Exceeding a limit
  responds `402 Payment Required` (`PlanLimitExceededException`), not a
  generic 400 — the semantically correct status for "this would require
  paying for more capacity."
  - **A design bug caught before it ever ran**: the first draft of
    `BillingService` read the tenant-scoped Prisma client ambiently from
    `TenantContextService`, like every other business-module service in
    this codebase. Wiring the staff-seat check into
    `AuthService.acceptInvitation` surfaced the problem before it was
    ever executed: that method runs its own manually-opened bootstrap
    transaction (no authenticated org context yet — the same category of
    situation ADR 0006 documents for signup), so `TenantContextService`
    has nothing to serve there. Fixed by refactoring every
    `BillingService` method to take an explicit `TenantPrismaClient`
    parameter, with thin `Mine`-prefixed wrappers
    (`assertMineClientLimit()`, etc.) for the ordinary already-scoped
    callers. `AuthService`/`MembershipsService` call the explicit-client
    versions directly, passing the bootstrap `tx` or the request's
    `tenantContext.client` as appropriate.
  - **Verified live via e2e** (not just unit-level assertions): a
    dedicated "Limits Test Co" organization on the Free plan is driven to
    exactly its `maxClients`/`maxStaff` limit and the next create/invite
    is asserted to 402.

- **Stripe Checkout** (`modules/billing/billing.service.ts`,
  `billing.controller.ts`, `dto/create-checkout-session.dto.ts`):
  `POST /organizations/me/subscription/checkout` (Owner/Admin only),
  against the real `stripe` npm package (v22.4.0), not a mock. Rejects
  `planCode: FREE` (400 — nothing to check out); creates and persists a
  Stripe Customer on first use (`stripeCustomerId`, reused on subsequent
  checkouts); creates a `mode: 'subscription'` Checkout Session for the
  plan's `stripePriceId`; 503s with a clear message if
  `STRIPE_SECRET_KEY` isn't configured or the target plan has no
  `stripePriceId` yet, instead of a confusing unhandled-exception 500.
  `subscription_data.metadata` on the session carries
  `{ organizationId, planCode }` through to the resulting Stripe
  Subscription object, so the webhook handler (below) can resolve the
  organization without an extra Stripe API round trip.
  - **What is and isn't verified**: without real Stripe credentials, the
    actual network calls (`stripe.customers.create`,
    `stripe.checkout.sessions.create`) are implemented against the real
    SDK's types and have not been exercised against Stripe's servers.
    What _is_ live-verified, via `curl` and e2e tests: the `FREE`
    rejection (400), the unconfigured-Stripe response (503), DTO
    validation on an invalid `planCode` (400), and the Owner/Admin-only
    gate (403 for a Staff caller).

- **Stripe webhook handler**
  (`modules/billing/stripe-webhook.controller.ts`,
  `BillingService.handleWebhookEvent`): `POST /webhooks/stripe`, `@Public()`
  (no DOS-issued JWT — Stripe's request signature is the authentication)
  and excluded from the OpenAPI contract (Stripe is its only caller).
  Verifies `Stripe-Signature` via `stripe.webhooks.constructEvent` against
  `STRIPE_WEBHOOK_SECRET`; on `checkout.session.completed` sets the
  organization's plan/`stripeSubscriptionId`/status to `ACTIVE`; on
  `customer.subscription.updated` syncs status (mapped from Stripe's) and
  `currentPeriodEnd`; on `customer.subscription.deleted` sets `CANCELED`.
  Unrecognized event types are acknowledged and ignored (Stripe's
  documented recommendation). `main.ts` now boots with
  `{ rawBody: true }` so the exact bytes Stripe signed are available
  (`req.rawBody`), separate from the parsed JSON body — signature
  verification over a re-serialized body would fail.
  - **No authenticated tenant context, same as bootstrap transactions**:
    a webhook has no session to carry `organizationId` through the normal
    interceptor. The target organization is resolved from event metadata
    (set on the Customer/Checkout Session/Subscription at checkout time),
    then processed inside its own `runInTenantTransaction` — the same
    pattern `modules/auth` uses for signup/invitation acceptance (ADR
    0006), applied to a third kind of caller with no ambient context.
  - **A real API-shape discovery, caught by `tsc`, not assumed**: the
    installed `stripe` SDK (pinned to Stripe API version
    `2026-07-29.dahlia`) no longer has a top-level
    `Subscription.current_period_end` — Stripe moved billing-period
    fields onto `items.data[].current_period_end` in a prior API version,
    to support subscriptions with multiple items on different cycles.
    The initial draft (written from memory of an older Stripe shape)
    failed to compile; fixed by reading
    `subscription.items.data[0]?.current_period_end` instead of guessing
    a permissive type.
  - **Genuinely verified end-to-end without a real Stripe account**:
    unlike checkout, signature verification is local HMAC computation
    keyed by `STRIPE_WEBHOOK_SECRET` alone — it makes no Stripe API call.
    The e2e "Stripe webhooks" suite generates real signed test events
    with `stripe.webhooks.generateTestHeaderString` against a
    locally-generated secret and asserts the resulting `Subscription`
    row in Postgres: an invalid signature is rejected (400);
    `checkout.session.completed` activates the plan and is reflected on
    `GET /organizations/me/subscription`; `customer.subscription.deleted`
    cancels it. This is real code executing the real verification and
    the real Prisma writes — the only thing not real is which server
    originally signed the payload.
  - **A re-run bug found and fixed via the project's own re-runnability
    discipline**: the first version of the webhook e2e tests used fixed
    fake Stripe object ids (`sub_test_123`). `Subscription.stripeSubscriptionId`
    is globally unique; re-running the suite against this sandbox's
    persistent (not reset per-run) database hit the same unique
    constraint a second time and 500'd. Fixed by suffixing every fake
    Stripe id with the suite's existing per-run `runId`, matching the
    unique-email pattern already used elsewhere in this file. Confirmed
    fixed by running the full suite twice in direct succession.

- **Comprehensive verification pass**: `pnpm turbo run lint build test`
  across the whole monorepo with the cache forced off (`--force`), all
  9 tasks green, including the full `apps/api` e2e suite (25 tests: the
  13 Fase 3 flows, 2 Free-plan-limit tests, 3 checkout tests, 3 webhook
  tests, plus the pre-existing RLS integration spec) run twice back to
  back against the same non-pristine database to confirm re-runnability.
  `docs/api/openapi.yaml` regenerated (`pnpm docs:api`) — confirmed the
  webhook controller does not leak into the contract (it's
  `@ApiExcludeController`'d, by design). `modules/billing/README.md`
  documents plan-limit enforcement, the checkout endpoint, and the
  webhook handler, including exactly what is and isn't live-verified.

## Fase 4 — cierre

- **Modelo de monetización**: planes por tier (Free/Pro/Business),
  confirmado con el usuario antes de escribir esquema — sin inventar el
  modelo de negocio.
- **Límites de uso reales, no cosméticos**: `maxClients`/`maxActiveJobs`/
  `maxStaff` se hacen cumplir en los cuatro puntos de creación relevantes
  (clientes, jobs, invitación de Staff, promoción a Staff), verificado en
  vivo llevando una organización Free hasta su límite exacto.
- **Integración real de Stripe**, no un mock: Checkout Sessions y
  webhooks contra el SDK real de `stripe`. Dado que no había credenciales
  de test disponibles (confirmado explícitamente por el usuario), cada
  ruta se diseñó para que su parte verificable sin red (validación,
  manejo de configuración ausente, verificación de firma HMAC) tuviera
  prueba real — no simulada — y cada parte que sí depende de red hacia
  Stripe quedó documentada explícitamente como pendiente, en vez de
  presentarse como completa.
- **Bug real de diseño encontrado antes de ejecutar código** (contexto de
  tenant ambiental no disponible en transacciones bootstrap) y **bug real
  de re-ejecución encontrado ejecutando la suite dos veces** (colisión de
  unique constraint con ids fijos) — ambos corregidos en la raíz, no
  parcheados.
- **Regla del producto de no avanzar sin aprobación**: se cumplió incluso
  bajo la autorización amplia de esta fase ("Dale todo enseguida") —
  esa autorización cubre _cómo_ trabajar (sin gate por paso, con
  autoverificación genuina en cada uno), no una aprobación implícita para
  saltar directamente a Fase 5.

**Fase 4 completa — esperando aprobación para Fase 5** (Expansión:
alcance a definir con el stakeholder — candidatos discutidos en la
Fase 1 original incluyen más verticales de field service, reportes/
analytics, y profundizar recurrencia de jobs). Por la regla del producto
de no avanzar de fase sin aprobación, Fase 5 no comienza hasta que el
stakeholder lo confirme explícitamente.
