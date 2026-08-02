# Multi-tenancy

DOS isolates every organization's data using **two independent layers**
that must both agree before a row is readable or writable. Neither layer
trusts the other — a bug in one is caught by the other.

## Layer 1: application-layer scoping

1. Every authenticated request carries a JWT access token whose payload
   includes the caller's **active** `organization_id` and `membershipId`
   (see [`auth.md`](./auth.md) for how the active organization is chosen —
   a user may belong to several).
2. A NestJS request-scoped interceptor resolves this `organization_id` and
   stores it in an `AsyncLocalStorage` context via `nestjs-cls`, available
   to every service in the request without it being threaded through every
   function call manually.
3. A Prisma Client Extension reads that context and automatically injects
   `organization_id` into the `where` clause of every read and the `data`
   of every write on tenant-scoped models. A developer writing
   `prisma.jobs.findMany()` inside a request gets an organization-scoped
   query without having to remember to add the filter — and code review
   flags any raw query that bypasses the extension.

## Layer 2: PostgreSQL Row-Level Security

Even if the application layer is bypassed entirely (a bug, a raw SQL
query, a future service that talks to the database directly), the database
itself refuses to return or accept rows for the wrong organization.

1. Every tenant-scoped table has RLS enabled and **forced** (`FORCE ROW
LEVEL SECURITY`, which applies the policy even to the table owner):

   ```sql
   ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
   ALTER TABLE jobs FORCE ROW LEVEL SECURITY;

   CREATE POLICY tenant_isolation ON jobs
     USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
     WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
   ```

   The policy is **fail-closed**: if `app.current_org_id` was never set on
   the connection, `current_setting(..., true)` returns `NULL`, `NULLIF`
   passes that through, and `organization_id = NULL` is never true in SQL —
   so an unscoped connection sees zero rows rather than all of them.

2. The API connects as a restricted Postgres role, `dos_app`, which does
   **not** have `BYPASSRLS`. A second, privileged role, `dos_migrator`
   (`BYPASSRLS`), is used exclusively by `prisma migrate deploy` — the
   running application can never see the migrator's elevated view.

3. Every request's Prisma call runs inside a Prisma **interactive
   transaction**, which pins a single database connection for its
   duration. The transaction's first statement is:

   ```sql
   SET LOCAL app.current_org_id = '<uuid>';
   ```

   `SET LOCAL` scopes the setting to the current transaction only — it
   cannot leak into a different request that happens to reuse the same
   pooled connection afterwards.

## Why `organization_id` is denormalized onto every table

Tables that are only reachable through a parent (e.g. `job_services`,
reachable via `jobs.id`) still carry their own `organization_id` column
directly, rather than requiring the RLS policy to `JOIN` through the parent
table. This keeps every policy a single-column equality check — simpler to
audit, and avoids RLS-induced query planner surprises on joined subqueries.

## The one exception: `users`

`users` is the only business-relevant table without an `organization_id`
column, because a user is a **global identity** that can hold memberships
in multiple organizations (see
[ADR 0005](../adr/0005-multi-org-membership.md)). It is not RLS-protected
by organization; instead, the API only ever exposes user records that share
an `organization_memberships` row with the caller's active organization —
enforced in the `users` module's service layer.

## Testing the isolation

A migration is not considered complete until a test proves the isolation
holds: seed two organizations, scope a client to one, and assert that
reading, joining into, and writing the other organization's data all fail
— through the ORM (both layers together) and, deliberately, through the
restricted `dos_app` role directly. See
[`apps/api/src/prisma/tenant-scoping.integration.spec.ts`](../../apps/api/src/prisma/tenant-scoping.integration.spec.ts),
which runs against a real PostgreSQL database rather than mocks, and
[`apps/api/src/prisma/README.md`](../../apps/api/src/prisma/README.md) for
how the mechanism itself (`run-in-tenant-transaction.ts`,
`tenant-scoping.extension.ts`, `tenant-transaction.interceptor.ts`) is
implemented.
