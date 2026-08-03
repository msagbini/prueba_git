# modules/billing

DOS's own billing relationship with the caller's active organization —
distinct from `modules/invoices`/`modules/payments`, which are the
cleaning business's billing to its own customers. See
[`docs/technical-log/phase-4.md`](../../../../../docs/technical-log/phase-4.md).

Every organization has exactly one `Subscription`, created on the Free
plan at signup (`AuthService.signup`).

| Method & path                        | Auth     | Notes                           |
| ------------------------------------ | -------- | ------------------------------- |
| `GET /organizations/me/subscription` | Required | Any member; subscription + plan |
