# ADR 0002: Prisma as the ORM

- **Status**: Accepted
- **Date**: Fase 2

## Context

The API needs an ORM/query layer for PostgreSQL that supports: (a) a
schema representation that's easy to audit against the product rule "no
invented fields without justification", (b) versioned, reviewable
migrations, and (c) a clean way to run `SET LOCAL app.current_org_id`
and the subsequent tenant-scoped query **on the same connection**, which
is the foundation of the Row-Level Security strategy (see
[`../architecture/multi-tenancy.md`](../architecture/multi-tenancy.md)).

## Decision

Use **Prisma** (`schema.prisma`, `prisma migrate`, Prisma Client) rather
than TypeORM.

## Alternatives considered

- **TypeORM**: NestJS's more "native" ORM choice via `@nestjs/typeorm`,
  with decorator-based entities. Rejected because entity definitions are
  spread across many files with decorators, which is harder to review as a
  whole against the "no invented fields" rule than a single
  `schema.prisma` file; and its query builder's result typing is weaker
  than Prisma's generated types.
- **Kysely / raw SQL with a query builder**: maximum control, but no
  migration tooling or schema-as-single-source-of-truth benefit, and would
  require hand-rolling the tenant-scoping-by-default mechanism entirely.

## Consequences

- Row-Level Security policies (`CREATE POLICY ...`) are not expressible in
  Prisma's schema DSL. They are hand-authored as raw SQL appended to a
  generated migration file (`prisma migrate dev --create-only`, then
  edited before applying) — a documented, standard Prisma pattern, not a
  workaround.
- The `SET LOCAL app.current_org_id` call requires Prisma's **interactive
  transactions** (`prisma.$transaction(async (tx) => {...})`), which pin a
  single connection for the transaction's duration — this is the mechanism
  the tenant-context wiring (see multi-tenancy doc) is built on.
- A Prisma Client Extension is used to auto-inject `organization_id` into
  tenant-scoped queries, giving the application-layer half of the
  multi-tenancy defense-in-depth strategy.
