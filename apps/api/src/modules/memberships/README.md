# modules/memberships

Manages who belongs to the caller's active organization and with what
role/status. Distinct from `modules/users` (global identity records) and
`modules/auth`'s invitation flow (how a membership is first created).

Guards against ever leaving an organization with zero active Owners —
demoting, suspending or removing the last one is rejected with 400.
Promoting a membership to Staff auto-creates its `StaffProfile` if one
doesn't already exist (mirrors what accepting a Staff invitation does).

| Method & path                                    | Auth                  | Notes                            |
| ------------------------------------------------ | --------------------- | -------------------------------- |
| `GET /organizations/me/members`                  | Required, Owner/Admin |                                  |
| `PATCH /organizations/me/members/:membershipId`  | Required, Owner/Admin | Change role/status, audit-logged |
| `DELETE /organizations/me/members/:membershipId` | Required, Owner/Admin | Remove from org, audit-logged    |
