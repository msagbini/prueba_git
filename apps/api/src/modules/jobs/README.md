# modules/jobs

Scheduled jobs: creation, status/scheduling, staff assignment, and the
services billed to a job. Per the RBAC matrix in
[`docs/architecture/auth.md`](../../../../../docs/architecture/auth.md),
a Staff caller only ever sees jobs they're assigned to, and a Client
caller only ever sees their own jobs.

`DELETE /jobs/:id` soft-deletes. `POST /jobs`/`.../assignments`/
`.../services` validate that `clientId`/`serviceAddressId`/
`membershipId`/`serviceId` actually belong to the caller's organization
(400, not a raw foreign-key error). `POST /jobs/:id/services` snapshots
the service's current `basePrice` into `unitPriceSnapshot` so later
catalog price changes don't retroactively change an already-booked job.

`PATCH /jobs/:id` also accepts `actualStart`/`actualEnd` (distinct from
`scheduledStart`/`scheduledEnd`) — when work actually happened, as
opposed to when it was planned. These existed in the schema since Fase 2
but had no way to be set until Fase 5, when `modules/reports`'
staff-performance report needed them for "hours worked".

`GET /jobs`/`GET /jobs/:id` embed `client` (id/name/contact info),
`serviceAddress` and `jobServices` (with the service name) — Staff holds
`jobs.read` but not `clients.read`/`services.read`, so without this a
Staff caller could see that a job existed but nothing about who it's for
or where to go. Added in Fase 6 for the mobile app's jobs list/detail
screens.

`POST /jobs/:id/start`/`/complete` ("clock in"/"clock out", Fase 6) let
the job's assigned Staff member — or Owner/Admin/Dispatcher — transition
it `DRAFT`/`SCHEDULED` → `IN_PROGRESS` → `COMPLETED` and set
`actualStart`/`actualEnd` to now, without needing `jobs.manage` (which
also grants reassignment/rescheduling/deletion — well beyond what
starting your own work requires). Gated to `jobs.read` plus the same
row-level visibility check as `list`/`findOne`; Client callers are
explicitly rejected (403) even though they hold `jobs.read` too.

| Method & path                | Auth                    | Notes                                              |
| ---------------------------- | ----------------------- | -------------------------------------------------- |
| `GET /jobs`                  | Required, `jobs.read`   | Staff: own assignments; Client: own jobs; enriched |
| `POST /jobs`                 | Required, `jobs.manage` | Audit-logged                                       |
| `GET /jobs/:id`              | Required, `jobs.read`   | Same row-level visibility as list; enriched        |
| `PATCH /jobs/:id`            | Required, `jobs.manage` | Audit-logged                                       |
| `DELETE /jobs/:id`           | Required, `jobs.manage` | Soft-delete, audit-logged                          |
| `POST /jobs/:id/start`       | Required, `jobs.read`   | Not Client; `DRAFT`/`SCHEDULED` → `IN_PROGRESS`    |
| `POST /jobs/:id/complete`    | Required, `jobs.read`   | Not Client; `IN_PROGRESS` → `COMPLETED`            |
| `POST /jobs/:id/assignments` | Required, `jobs.manage` | Assign staff, audit-logged                         |
| `POST /jobs/:id/services`    | Required, `jobs.manage` | Snapshots price, audit-logged                      |
