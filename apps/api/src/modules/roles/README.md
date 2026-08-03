# modules/roles

Read-only reference data: the fixed system roles and permissions seeded
by `prisma/seed.ts`. See the RBAC matrix in
[`docs/architecture/auth.md`](../../../../../docs/architecture/auth.md).

Unlike every other module here, this one is **fully implemented**, not
stubbed — listing global, non-tenant reference data has no business logic
to defer to Fase 3.

| Method & path      | Auth     | Notes                |
| ------------------ | -------- | -------------------- |
| `GET /roles`       | Required | All system roles     |
| `GET /permissions` | Required | All permission codes |
