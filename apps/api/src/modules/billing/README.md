# modules/billing

DOS's own billing relationship with the caller's active organization —
distinct from `modules/invoices`/`modules/payments`, which are the
cleaning business's billing to its own customers. See
[`docs/technical-log/phase-4.md`](../../../../../docs/technical-log/phase-4.md).

Every organization has exactly one `Subscription`, created on the Free
plan at signup (`AuthService.signup`).

| Method & path                                  | Auth        | Notes                                                                                      |
| ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `GET /organizations/me/subscription`           | Required    | Any member; subscription + plan                                                            |
| `POST /organizations/me/subscription/checkout` | Owner/Admin | Starts a Stripe Checkout session; 400 for `planCode: FREE`, 503 if Stripe isn't configured |

## Plan-limit enforcement

`BillingService.assert*Limit` methods are called by `modules/clients`,
`modules/jobs`, `modules/auth` (Staff invitation acceptance) and
`modules/memberships` (promotion to Staff) before creating the row that
would push the organization over its plan's `maxClients` /
`maxActiveJobs` / `maxStaff`. Exceeding a limit responds `402 Payment
Required` (`PlanLimitExceededException`).

## Stripe integration

`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are optional env vars. This
project has not yet been given real Stripe credentials (see
[`docs/technical-log/phase-4.md`](../../../../../docs/technical-log/phase-4.md)),
so the Checkout Session code path is implemented against the real `stripe`
SDK but has only been verified for its config-missing branch (`503`) and
its input-validation branch (`400` on `planCode: FREE`) — the actual round
trip to Stripe's API is unverified until real test keys are supplied.

### Webhooks

`POST /webhooks/stripe` (public, excluded from the OpenAPI contract —
Stripe is its only caller) verifies the `Stripe-Signature` header against
`STRIPE_WEBHOOK_SECRET` (`stripe.webhooks.constructEvent`) and syncs the
relevant organization's `Subscription`:

| Event                           | Effect                                                       |
| ------------------------------- | ------------------------------------------------------------ |
| `checkout.session.completed`    | Sets `planId`, `stripeSubscriptionId`, `status: ACTIVE`      |
| `customer.subscription.updated` | Syncs `status` (mapped from Stripe's) and `currentPeriodEnd` |
| `customer.subscription.deleted` | Sets `status: CANCELED`                                      |

The target organization is resolved from `metadata.organizationId`, set on
the Stripe Customer, Checkout Session, and (via `subscription_data.metadata`
at checkout creation) the resulting Subscription itself — not from an
authenticated request, since Stripe is the caller. This mirrors the
bootstrap-transaction pattern `modules/auth` uses for signup/invitation
acceptance (ADR 0006): no ambient tenant context, so `BillingService` opens
its own `runInTenantTransaction` once it has resolved the organization id.

Signature verification requires only `STRIPE_WEBHOOK_SECRET`, not
`STRIPE_SECRET_KEY` — it's local HMAC verification, not a Stripe API call
— so unlike checkout, this path is fully verified end-to-end in this
sandbox: `apps/api/test/business-flows.e2e.spec.ts`'s "Stripe webhooks"
suite generates real signed test events with
`stripe.webhooks.generateTestHeaderString` and asserts the resulting
`Subscription` state, with no real Stripe account involved.
