# modules/users

Users visible within the caller's active organization — i.e. users
sharing an `organization_memberships` row with it. `users` itself has no
`organizationId`/RLS (see docs/architecture/multi-tenancy.md), so this
scoping must be enforced at the service layer here, not by the database.

`update`/`remove` are allowed for the caller themselves (self-service) or
for an Owner/Admin managing another member — anyone else gets 403.
`remove` deletes the `OrganizationMembership` (this person leaves the
org), never the global `User` row, which may still be needed for other
organizations they belong to — delegated to `modules/memberships` so the
last-Owner guard isn't duplicated.

| Method & path       | Auth     | Notes                                            |
| ------------------- | -------- | ------------------------------------------------ |
| `GET /users`        | Required | Scoped to shared-membership users                |
| `GET /users/:id`    | Required | 404 if not in a shared organization              |
| `PATCH /users/:id`  | Required | Self or Owner/Admin only, audit-logged           |
| `DELETE /users/:id` | Required | Self or Owner/Admin only; removes the membership |
