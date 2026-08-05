import { Injectable, NotFoundException } from '@nestjs/common';
import type { Organization, Prisma } from '@prisma/client';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AuditLogWriterService } from '../audit-logs/audit-log-writer.service';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';

/**
 * Organization settings for the caller's active organization. `Organization`
 * has no `organizationId` column — its tenant boundary is its own `id` —
 * so every query here filters explicitly by `id: organizationId` rather
 * than relying on Row-Level Security alone (defense in depth, same as
 * every other tenant-scoped query in this codebase).
 */
@Injectable()
export class OrganizationsService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   * @param auditLog records changes made through this service
   */
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly auditLog: AuditLogWriterService,
  ) {}

  /**
   * Fetches the organization.
   * @param organizationId the caller's active organization
   * @returns the caller's active organization
   */
  async getMine(organizationId: string): Promise<Organization> {
    return this.findOrThrow(organizationId);
  }

  /**
   * Updates the organization.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param dto the fields to update
   * @returns the updated organization
   */
  async updateMine(
    organizationId: string,
    actorUserId: string,
    dto: UpdateOrganizationDto,
  ): Promise<Organization> {
    const before = await this.findOrThrow(organizationId);

    const after = await this.tenantContext.client.organization.update({
      where: { id: organizationId },
      data: {
        name: dto.name,
        timezone: dto.timezone,
        locale: dto.locale,
        defaultCurrency: dto.defaultCurrency,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'organization.updated',
      entityType: 'Organization',
      entityId: organizationId,
      before,
      after,
    });

    return after;
  }

  /**
   * Fetches the organization or throws if it can't be found.
   * @param organizationId the caller's active organization
   * @returns the matching organization
   * @throws NotFoundException if no organization matches — should not
   *   happen for an authenticated request, but guards against RLS/data
   *   inconsistencies surfacing as a confusing 500 instead of a clear 404
   */
  private async findOrThrow(organizationId: string): Promise<Organization> {
    const organization = await this.tenantContext.client.organization.findFirst({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }
    return organization;
  }
}
