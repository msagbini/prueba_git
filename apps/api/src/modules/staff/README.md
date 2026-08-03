# modules/staff

Employment-specific fields for staff members (`StaffProfile`, 1:1 with an
`OrganizationMembership`). Staff profiles are created via the invitation
flow in `modules/auth`, not here — this module only reads/updates them.

**Fase 2 scope**: contract only — see `staff.service.ts` and root
`CONTRIBUTING.md`.

| Method & path      | Auth     | Notes |
| ------------------ | -------- | ----- |
| `GET /staff`       | Required |       |
| `GET /staff/:id`   | Required |       |
| `PATCH /staff/:id` | Required |       |
