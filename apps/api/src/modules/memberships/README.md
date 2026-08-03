# modules/memberships

Manages who belongs to the caller's active organization and with what
role/status. Distinct from `modules/users` (global identity records) and
`modules/auth`'s invitation flow (how a membership is first created).

**Fase 2 scope**: contract only — see `memberships.service.ts` and root
`CONTRIBUTING.md`.

| Method & path                                    | Auth                  | Notes              |
| ------------------------------------------------ | --------------------- | ------------------ |
| `GET /organizations/me/members`                  | Required, Owner/Admin |                    |
| `PATCH /organizations/me/members/:membershipId`  | Required, Owner/Admin | Change role/status |
| `DELETE /organizations/me/members/:membershipId` | Required, Owner/Admin | Remove from org    |
