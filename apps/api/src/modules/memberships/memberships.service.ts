import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, RoleCode, type OrganizationMembership, type Role } from '@prisma/client';
import { SAFE_USER_SELECT, type SafeUser } from '../../common/safe-user';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AuditLogWriterService } from '../audit-logs/audit-log-writer.service';
import type { UpdateMembershipDto } from './dto/update-membership.dto';

/** A membership row joined with the fields a members list needs to display. */
export type MembershipWithUserAndRole = OrganizationMembership & { user: SafeUser; role: Role };

/**
 * Manages who belongs to the caller's active organization and with what
 * role/status — distinct from `modules/users` (global identity) and
 * `modules/auth`'s invitation flow (how a membership is first created).
 * Guards against ever leaving an organization with zero active Owners,
 * since that would permanently lock every remaining member out of
 * Owner-only actions (billing, org settings) with no way to recover it.
 */
@Injectable()
export class MembershipsService {
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
   * @returns every membership in the caller's active organization
   */
  list(): Promise<MembershipWithUserAndRole[]> {
    return this.tenantContext.client.organizationMembership.findMany({
      include: { user: { select: SAFE_USER_SELECT }, role: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /**
   * Updates a membership's role and/or status.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param membershipId the membership to update
   * @param dto the fields to change
   * @returns the updated membership
   */
  async update(
    organizationId: string,
    actorUserId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
  ): Promise<MembershipWithUserAndRole> {
    const before = await this.findOrThrow(membershipId);

    const demotingFromOwner = dto.roleCode !== undefined && dto.roleCode !== RoleCode.OWNER;
    const deactivating = dto.status !== undefined && dto.status !== MembershipStatus.ACTIVE;
    if (before.role.code === RoleCode.OWNER && (demotingFromOwner || deactivating)) {
      await this.assertNotLastActiveOwner(membershipId);
    }

    const after = await this.tenantContext.client.organizationMembership.update({
      where: { id: membershipId },
      data: {
        role: dto.roleCode ? { connect: { code: dto.roleCode } } : undefined,
        status: dto.status,
      },
      include: { user: { select: SAFE_USER_SELECT }, role: true },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'membership.updated',
      entityType: 'OrganizationMembership',
      entityId: membershipId,
      before,
      after,
    });

    return after;
  }

  /**
   * Removes a membership from the caller's active organization.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param membershipId the membership to remove
   */
  async remove(organizationId: string, actorUserId: string, membershipId: string): Promise<void> {
    const before = await this.findOrThrow(membershipId);

    if (before.role.code === RoleCode.OWNER) {
      await this.assertNotLastActiveOwner(membershipId);
    }

    await this.tenantContext.client.organizationMembership.delete({ where: { id: membershipId } });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'membership.removed',
      entityType: 'OrganizationMembership',
      entityId: membershipId,
      before,
    });
  }

  /**
   * Fetches a membership (with its user and role) or throws if it can't be found.
   * @param membershipId the membership to fetch
   * @returns the matching membership
   * @throws NotFoundException if no membership matches in the caller's active organization
   */
  private async findOrThrow(membershipId: string): Promise<MembershipWithUserAndRole> {
    const membership = await this.tenantContext.client.organizationMembership.findFirst({
      where: { id: membershipId },
      include: { user: { select: SAFE_USER_SELECT }, role: true },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found.');
    }
    return membership;
  }

  /**
   * Guards against removing the organization's last active Owner. Uses the
   * tenant-scoped client (not the plain `PrismaService`) because
   * `OrganizationMembership` is Row-Level-Security-protected — a query
   * against the plain client would run with no `app.current_org_id` set
   * for this connection and RLS would fail closed to zero rows, always
   * reporting "no owners left" and blocking every legitimate change.
   * @param excludingMembershipId the membership being changed, excluded from the count
   * @throws BadRequestException if `excludingMembershipId` is the only remaining active Owner
   */
  private async assertNotLastActiveOwner(excludingMembershipId: string): Promise<void> {
    const remainingActiveOwners = await this.tenantContext.client.organizationMembership.count({
      where: {
        status: MembershipStatus.ACTIVE,
        role: { code: RoleCode.OWNER },
        id: { not: excludingMembershipId },
      },
    });
    if (remainingActiveOwners === 0) {
      throw new BadRequestException('An organization must always have at least one active Owner.');
    }
  }
}
