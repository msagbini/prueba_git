# modules/jobs

Scheduled jobs: creation, status/scheduling, staff assignment, and the
services billed to a job. Per the RBAC matrix in
[`docs/architecture/auth.md`](../../../../../docs/architecture/auth.md),
a Staff caller only ever sees jobs they're assigned to.

**Fase 2 scope**: contract only — see `jobs.service.ts` and root
`CONTRIBUTING.md`.

| Method & path                | Auth     | Notes                               |
| ---------------------------- | -------- | ----------------------------------- |
| `GET /jobs`                  | Required | Scoped to own assignments for Staff |
| `POST /jobs`                 | Required |                                     |
| `GET /jobs/:id`              | Required |                                     |
| `PATCH /jobs/:id`            | Required |                                     |
| `DELETE /jobs/:id`           | Required |                                     |
| `POST /jobs/:id/assignments` | Required | Assign staff                        |
| `POST /jobs/:id/services`    | Required | Add a billed service                |
