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
`serviceAddress`, `jobServices` (with the service name) and `assignments`
(with the assigned staff member's safe user fields) — Staff holds
`jobs.read` but not `clients.read`/`services.read`, so without this a
Staff caller could see that a job existed but nothing about who it's for
or where to go. `client`/`serviceAddress`/`jobServices` were added in
Fase 6 for the mobile app's jobs list/detail screens; `assignments` in
Fase 9, so the web dispatch UI could show who's already on a job instead
of "assign staff" being write-only.

`GET /jobs` is paginated (`?page=&pageSize=`, capped at 100 — see
`common/pagination.ts`) since Fase 9; the response is
`{ items, page, pageSize, total, totalPages }`, not a bare array.

### Recurring jobs (Fase 9)

`recurrenceRule` (an RFC 5545 RRULE option string, e.g.
`FREQ=WEEKLY;INTERVAL=2`) has existed on `Job` since Fase 2, but nothing
processed it until Fase 9. `RecurringJobsService` runs daily
(`@nestjs/schedule`) and, for every organization, materializes the next
due occurrence (7-day lookahead) of any job with a `recurrenceRule` and
no `parentJobId` (a "root") as a real child `Job` — idempotent, and
scoped through the same RLS-protected path every request uses. See that
service's own doc comments for the one real architectural wrinkle: a
background job has no per-request tenant context, so it needs a narrow,
dedicated RLS policy just to enumerate organizations.

### Attachments (Fase 9)

`POST /jobs/:id/attachments` (multipart, field name `file`) uploads a
photo (JPEG/PNG/WebP, 10MB max) as evidence on a job — before/after
cleaning photos, most concretely. Stored on local disk under
`UPLOADS_DIR`, one subdirectory per organization; served back through
`GET /jobs/:id/attachments/:attachmentId` (authenticated, tenant-scoped
streaming — not static file serving, which would make a guessable path
leak another organization's photos) rather than a public URL.

`POST /jobs/:id/start`/`/complete` ("clock in"/"clock out", Fase 6) let
the job's assigned Staff member — or Owner/Admin/Dispatcher — transition
it `DRAFT`/`SCHEDULED` → `IN_PROGRESS` → `COMPLETED` and set
`actualStart`/`actualEnd` to now, without needing `jobs.manage` (which
also grants reassignment/rescheduling/deletion — well beyond what
starting your own work requires). Gated to `jobs.read` plus the same
row-level visibility check as `list`/`findOne`; Client callers are
explicitly rejected (403) even though they hold `jobs.read` too.

| Method & path                             | Auth                    | Notes                                              |
| ----------------------------------------- | ----------------------- | -------------------------------------------------- |
| `GET /jobs`                               | Required, `jobs.read`   | Staff: own assignments; Client: own jobs; enriched |
| `POST /jobs`                              | Required, `jobs.manage` | Audit-logged                                       |
| `GET /jobs/:id`                           | Required, `jobs.read`   | Same row-level visibility as list; enriched        |
| `PATCH /jobs/:id`                         | Required, `jobs.manage` | Audit-logged                                       |
| `DELETE /jobs/:id`                        | Required, `jobs.manage` | Soft-delete, audit-logged                          |
| `POST /jobs/:id/start`                    | Required, `jobs.read`   | Not Client; `DRAFT`/`SCHEDULED` → `IN_PROGRESS`    |
| `POST /jobs/:id/complete`                 | Required, `jobs.read`   | Not Client; `IN_PROGRESS` → `COMPLETED`            |
| `POST /jobs/:id/assignments`              | Required, `jobs.manage` | Assign staff, audit-logged                         |
| `POST /jobs/:id/services`                 | Required, `jobs.manage` | Snapshots price, audit-logged                      |
| `POST /jobs/:id/attachments`              | Required, `jobs.read`   | Multipart upload (`file`), audit-logged            |
| `GET /jobs/:id/attachments`               | Required, `jobs.read`   | Same row-level visibility as list                  |
| `GET /jobs/:id/attachments/:attachmentId` | Required, `jobs.read`   | Streams the file, tenant-scoped                    |
