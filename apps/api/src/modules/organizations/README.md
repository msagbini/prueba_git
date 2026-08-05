# modules/organizations

Organization settings for the caller's active organization.

Every query filters explicitly by `id: organizationId` rather than
relying on Row-Level Security alone — `Organization` has no
`organizationId` column, its tenant boundary is its own `id`.

| Method & path             | Auth                  | Notes                      |
| ------------------------- | --------------------- | -------------------------- |
| `GET /organizations/me`   | Required              | Any member                 |
| `PATCH /organizations/me` | Required, Owner/Admin | Audit-logged, before/after |
