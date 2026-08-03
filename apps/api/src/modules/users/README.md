# modules/users

Users visible within the caller's active organization — i.e. users
sharing an `organization_memberships` row with it. `users` itself has no
`organizationId`/RLS (see docs/architecture/multi-tenancy.md), so this
scoping must be enforced at the service layer here, not by the database.

**Fase 2 scope**: contract only — see `users.service.ts` and root
`CONTRIBUTING.md`.

| Method & path       | Auth     | Notes                                |
| ------------------- | -------- | ------------------------------------ |
| `GET /users`        | Required | Scoped to shared-membership users    |
| `GET /users/:id`    | Required |                                      |
| `PATCH /users/:id`  | Required |                                      |
| `DELETE /users/:id` | Required | Removes from the active organization |
