# modules/reports

Read-only operational and financial reports for the caller's active
organization, computed from data the Fase 3 business modules already
write (`Payment`, `Job`, `Invoice`, `StaffProfile`) — no new schema. See
[`docs/technical-log/phase-5.md`](../../../../../docs/technical-log/phase-5.md).

Every route requires `reports.read`, granted only to Owner/Admin (see
`prisma/seed.ts`) — financial data is not exposed to Dispatcher/Staff/Client.

| Method & path                       | Notes                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `GET /reports/revenue`              | Total + time-bucketed (`day`/`week`/`month`) completed-payment revenue |
| `GET /reports/jobs-summary`         | Job counts by status, for jobs created in range                        |
| `GET /reports/staff-performance`    | Per-staff completed-job count and hours worked, sorted descending      |
| `GET /reports/top-clients`          | Highest-revenue clients (completed payments) + their job count         |
| `GET /reports/outstanding-invoices` | Current snapshot: unpaid invoice balance, total and overdue            |

All routes except `outstanding-invoices` take optional `from`/`to` query
params (ISO 8601), defaulting to the last 30 days. `revenue` additionally
takes `granularity` (`day` default); `top-clients` takes `limit` (10
default, max 100).

## Why application-side aggregation, not SQL `groupBy`/raw queries

The tenant-scoping Prisma extension (`prisma/tenant-scoping.extension.ts`)
auto-injects `organizationId` into `findMany`/`count`/etc., but explicitly
does **not** cover `groupBy`/`aggregate` or raw SQL — those would need to
be scoped by hand, which is an easy place to accidentally leak
cross-tenant data in a reporting feature that's supposed to look _across_
many rows. Every report here fetches the relevant rows via `findMany`
(auto-scoped, with Postgres RLS as a second fail-closed layer regardless)
and reduces them in TypeScript. Simple, safe, and fast enough at the
per-organization data volumes this product operates at.
