import { Injectable, NotFoundException } from '@nestjs/common';
import type { StaffProfile } from '@prisma/client';
import { SAFE_USER_SELECT, type SafeUser } from '../../common/safe-user';
import { toDateOrUndefined } from '../../common/to-date';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AuditLogWriterService } from '../audit-logs/audit-log-writer.service';
import type { UpdateStaffDto } from './dto/update-staff.dto';

/** A staff profile joined with the membership fields a staff list needs to display who it belongs to. */
export type StaffProfileWithUser = StaffProfile & { membership: { user: SafeUser } };

/**
 * Employment-specific fields for staff members (`StaffProfile`, 1:1 with
 * an `OrganizationMembership`). Creation happens automatically when a
 * Staff invitation is accepted or a membership is promoted to Staff (see
 * `AuthService.acceptInvitation` and `MembershipsService.update`) — not
 * here, since a `StaffProfile` only ever makes sense attached to an
 * existing Staff membership.
 */
@Injectable()
export class StaffService {
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
   * Lists records.
   * @returns every staff profile in the caller's active organization
   */
  list(): Promise<StaffProfileWithUser[]> {
    return this.tenantContext.client.staffProfile.findMany({
      include: { membership: { select: { user: { select: SAFE_USER_SELECT } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Fetches a single record.
   * @param id the staff profile to fetch
   * @returns the matching record
   */
  async findOne(id: string): Promise<StaffProfileWithUser> {
    return this.findOrThrow(id);
  }

  /**
   * Updates a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param id the staff profile to update
   * @param dto the fields to change
   * @returns the updated record
   */
  async update(
    organizationId: string,
    actorUserId: string,
    id: string,
    dto: UpdateStaffDto,
  ): Promise<StaffProfileWithUser> {
    const before = await this.findOrThrow(id);

    const after = await this.tenantContext.client.staffProfile.update({
      where: { id },
      data: {
        employeeCode: dto.employeeCode,
        hourlyRate: dto.hourlyRate,
        hireDate: toDateOrUndefined(dto.hireDate),
        status: dto.status,
      },
      include: { membership: { select: { user: { select: SAFE_USER_SELECT } } } },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'staff_profile.updated',
      entityType: 'StaffProfile',
      entityId: id,
      before,
      after,
    });

    return after;
  }

  /**
   * Fetches a staff profile (with its member's user) or throws if it can't be found.
   * @param id the staff profile to fetch
   * @returns the matching record
   * @throws NotFoundException if no staff profile matches in the caller's active organization
   */
  private async findOrThrow(id: string): Promise<StaffProfileWithUser> {
    const profile = await this.tenantContext.client.staffProfile.findFirst({
      where: { id },
      include: { membership: { select: { user: { select: SAFE_USER_SELECT } } } },
    });
    if (!profile) {
      throw new NotFoundException('Staff profile not found.');
    }
    return profile;
  }
}
