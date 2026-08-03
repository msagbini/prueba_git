# modules/audit-logs

Read-only access to the append-only audit trail for the caller's active
organization. Owner/Admin only. Nothing writes to `audit_logs` through
this module — entries are written by the modules whose actions they
record.

**Fase 2 scope**: contract only — see `audit-logs.service.ts` and root
`CONTRIBUTING.md`.

| Method & path     | Auth                  | Notes |
| ----------------- | --------------------- | ----- |
| `GET /audit-logs` | Required, Owner/Admin |       |
