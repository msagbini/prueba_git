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

| Method & path                | Auth                    | Notes                                    |
| ---------------------------- | ----------------------- | ---------------------------------------- |
| `GET /jobs`                  | Required, `jobs.read`   | Staff: own assignments; Client: own jobs |
| `POST /jobs`                 | Required, `jobs.manage` | Audit-logged                             |
| `GET /jobs/:id`              | Required, `jobs.read`   | Same row-level visibility as list        |
| `PATCH /jobs/:id`            | Required, `jobs.manage` | Audit-logged                             |
| `DELETE /jobs/:id`           | Required, `jobs.manage` | Soft-delete, audit-logged                |
| `POST /jobs/:id/assignments` | Required, `jobs.manage` | Assign staff, audit-logged               |
| `POST /jobs/:id/services`    | Required, `jobs.manage` | Snapshots price, audit-logged            |
