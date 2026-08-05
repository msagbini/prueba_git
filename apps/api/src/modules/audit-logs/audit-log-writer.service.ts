import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TenantContextService } from '../../prisma/tenant-context.service';

/** One entry to append to the audit trail — see `audit_logs` in schema.prisma. */
export interface AuditLogEntry {
  /** The organization the action happened in. */
  organizationId: string;
  /** The global User id of the caller who performed the action. */
  actorUserId: string;
  /** A dotted action code, e.g. `"client.created"`, `"job.status_changed"`. */
  action: string;
  /** The Prisma model name of the affected entity, e.g. `"Client"`. */
  entityType: string;
  /** The affected entity's id. */
  entityId: string;
  /** The entity's state before the change, omitted for creates. */
  before?: unknown;
  /** The entity's state after the change, omitted for deletes. */
  after?: unknown;
}

/**
 * Converts a value (which may contain Prisma `Decimal`/`Date` instances)
 * into a plain JSON-safe value for a Prisma `Json` column, via their
 * `toJSON()` methods — the same conversion `JSON.stringify` already does,
 * reused here so the round-trip also strips non-JSON-safe values like
 * `undefined`.
 * @param value the value to convert
 * @returns a JSON-safe value, or `undefined` if `value` is `undefined`
 */
function toJsonSafe(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined
    ? undefined
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

/**
 * Appends entries to the append-only `audit_logs` table. Every business
 * module calls this after a mutation succeeds — see the RBAC/audit note in
 * each module's README. Writes go through the same tenant-scoped Prisma
 * client (and therefore the same transaction) as the mutation itself, so
 * an audit entry can never exist without the change it records, or vice
 * versa.
 */
@Injectable()
export class AuditLogWriterService {
  /**
   * Constructs the writer around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   */
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Records one audit log entry.
   * @param entry the entry to record
   */
  async record(entry: AuditLogEntry): Promise<void> {
    await this.tenantContext.client.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        beforeState: toJsonSafe(entry.before),
        afterState: toJsonSafe(entry.after),
      },
    });
  }
}
