# modules/audit-logs

Read-only access to the append-only audit trail for the caller's active
organization. Owner/Admin only. Nothing writes to `audit_logs` through
this controller — entries are written by `AuditLogWriterService`
(`audit-log-writer.service.ts`, exported from this module), called by
every other business module after a mutation succeeds.

| Method & path     | Auth                  | Notes             |
| ----------------- | --------------------- | ----------------- |
| `GET /audit-logs` | Required, Owner/Admin | Most recent first |
