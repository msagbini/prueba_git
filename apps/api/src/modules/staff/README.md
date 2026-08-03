# modules/staff

Employment-specific fields for staff members (`StaffProfile`, 1:1 with an
`OrganizationMembership`). Staff profiles are created via the invitation
flow in `modules/auth`, not here — this module only reads/updates them.

A `StaffProfile` is created automatically when a Staff invitation is
accepted (`AuthService.acceptInvitation`) or a membership is promoted to
Staff (`MembershipsService.update`) — there is no `POST /staff` route.

| Method & path      | Auth                     | Notes        |
| ------------------ | ------------------------ | ------------ |
| `GET /staff`       | Required, `staff.read`   |              |
| `GET /staff/:id`   | Required, `staff.read`   |              |
| `PATCH /staff/:id` | Required, `staff.manage` | Audit-logged |
