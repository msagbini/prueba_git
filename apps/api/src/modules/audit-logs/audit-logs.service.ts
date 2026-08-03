import { Injectable, NotImplementedException } from '@nestjs/common';
import { TenantContextService } from '../../prisma/tenant-context.service';

/**
 * Read-only access to the append-only audit trail for the caller's
 * active organization. Owner/Admin only (see the RBAC matrix in
 * docs/architecture/auth.md). Nothing writes to `audit_logs` through
 * this module — entries are written by the modules whose actions they
 * record. Fase 2 scope note: see `organizations.service.ts` for the
 * pattern this follows.
 */
@Injectable()
export class AuditLogsService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   */
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Lists records. Stubbed for Fase 3 — see the class-level scope note.
   */
  list(): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }
}
