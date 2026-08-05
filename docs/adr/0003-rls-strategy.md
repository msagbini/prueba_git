# ADR 0003: Postgres Row-Level Security as a second tenant-isolation layer

- **Status**: Accepted
- **Date**: Fase 2

## Context

Application-layer tenant scoping (filtering every query by
`organization_id`) is necessary but not sufficient on its own: a single
missed filter in a service method, a raw query added under time pressure,
or a future internal tool that talks to the database directly could leak
data across organizations. For a product whose entire value proposition
depends on tenant data never mixing, a single point of failure is not
acceptable.

## Decision

Enable and **force** Postgres Row-Level Security on every tenant-scoped
table, with a fail-closed policy keyed on a session variable
(`app.current_org_id`) set once per request transaction. Full mechanism
documented in
[`../architecture/multi-tenancy.md`](../architecture/multi-tenancy.md).

Two Postgres roles are used: `dos_migrator` (`BYPASSRLS`, used only by the
migration tooling) and `dos_app` (no bypass, used by the running API).

## Alternatives considered

- **Application-layer scoping only**: simpler, but a single bug is a
  cross-tenant data leak — unacceptable given the product's multi-tenant
  guarantee is a core sales claim, not an implementation detail.
- **Schema-per-tenant** (each organization gets its own Postgres schema or
  database): stronger isolation but operationally heavy — migrations must
  run per-tenant, connection pooling gets harder, and it doesn't scale
  smoothly to hundreds of small tenants, which is this product's expected
  shape (many small cleaning businesses, not a few huge enterprises).
  Documented as a possible future path for a large enterprise/white-label
  customer that specifically requires it, not a Fase 2 decision.

## Consequences

- Every new tenant-scoped table's migration must include its RLS policy —
  this is a checklist item in code review, not automatic. A missing policy
  is a silent gap, so table/policy pairs are added in the same migration
  (see Fase 2 build sequence in `docs/technical-log/phase-2.md`).
- Local development requires the `SET LOCAL`/session-variable mechanism to
  be wired correctly even for one-off scripts and the seed script, or
  they'll see zero rows (fail-closed) rather than a puzzling subset.
