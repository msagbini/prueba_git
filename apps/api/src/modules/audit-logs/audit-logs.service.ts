import { Injectable } from '@nestjs/common';
import type { AuditLog } from '@prisma/client';
import { TenantContextService } from '../../prisma/tenant-context.service';

/**
 * Read-only access to the append-only audit trail for the caller's
 * active organization. Owner/Admin only (see the RBAC matrix in
 * docs/architecture/auth.md). Nothing writes to `audit_logs` through
 * this module — entries are written by the modules whose actions they
 * record, via `AuditLogWriterService`.
 */
@Injectable()
export class AuditLogsService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   */
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Lists records, most recent first.
   * @returns every audit log entry for the caller's active organization
   */
  list(): Promise<AuditLog[]> {
    return this.tenantContext.client.auditLog.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
