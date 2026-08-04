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
