# modules/plans

Read-only reference data: the subscription tiers DOS itself sells to
organizations — `Free`/`Pro`/`Business`, seeded by `prisma/seed.ts`. Not
to be confused with `modules/invoices`/`modules/payments`, which are the
cleaning business's own billing to its customers. See
[`docs/technical-log/phase-4.md`](../../../../../docs/technical-log/phase-4.md).

| Method & path | Auth     | Notes                     |
| ------------- | -------- | ------------------------- |
| `GET /plans`  | Required | All plans, cheapest first |
