# modules/organizations

Organization settings for the caller's active organization.

**Fase 2 scope**: contract only (controller, DTOs, Swagger, guards) —
service methods throw `NotImplementedException`. Implementation lands in
Fase 3. See root `CONTRIBUTING.md` for why this is an accepted pattern
rather than a placeholder.

| Method & path             | Auth                  | Notes      |
| ------------------------- | --------------------- | ---------- |
| `GET /organizations/me`   | Required              | Any member |
| `PATCH /organizations/me` | Required, Owner/Admin |            |
