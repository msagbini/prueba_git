import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { SAFE_USER_SELECT, type SafeUser } from '../../common/safe-user';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AuditLogWriterService } from '../audit-logs/audit-log-writer.service';
import { MembershipsService } from '../memberships/memberships.service';
import type { UpdateUserDto } from './dto/update-user.dto';

/**
 * Users visible to the caller — i.e. users who share an
 * `organization_memberships` row with the caller's active organization
 * (see the "one exception: users" section of
 * docs/architecture/multi-tenancy.md; `users` itself has no
 * `organizationId`/RLS, so this scoping is enforced here at the service
 * layer, not by the database).
 *
 * `update`/`remove` are allowed for the caller themselves (self-service
 * profile edit) or for an Owner/Admin managing another member — anyone
 * else is rejected, since profile fields and org membership are not
 * something a Dispatcher/Staff/Client should be able to change for
 * someone else. `remove` deletes the `OrganizationMembership` (this
 * person leaves the org), never the global `User` row, which may still
 * be needed for other organizations they belong to — delegated to
 * `MembershipsService` so the "never leave an org with zero Owners" guard
 * lives in exactly one place.
 */
@Injectable()
export class UsersService {
  /**
   * Constructs the service around the tenant-scoped and plain Prisma clients.
   * @param tenantContext the current request's tenant-scoped Prisma client, for the membership join
   * @param prisma the plain (unscoped) Prisma client, for the global users table
   * @param auditLog records changes made through this service
   * @param memberships used to remove a user's membership (with the last-Owner guard) on `remove`
   */
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogWriterService,
    private readonly memberships: MembershipsService,
  ) {}

  /**
   * Lists records.
   * @returns every user sharing a membership with the caller's active organization
   */
  async list(): Promise<SafeUser[]> {
    const memberships = await this.tenantContext.client.organizationMembership.findMany({
      select: { user: { select: SAFE_USER_SELECT } },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.map((m) => m.user);
  }

  /**
   * Fetches a single record.
   * @param id the user to fetch
   * @returns the matching record
   */
  async findOne(id: string): Promise<SafeUser> {
    return (await this.findMembershipOrThrow(id)).user;
  }

  /**
   * Updates a record.
   * @param organizationId the caller's active organization
   * @param actor the caller, for authorization and the audit trail
   * @param actor.userId the caller's global User id
   * @param actor.role the caller's active membership role
   * @param id the user to update
   * @param dto the fields to change
   * @returns the updated record
   */
  async update(
    organizationId: string,
    actor: { userId: string; role: string },
    id: string,
    dto: UpdateUserDto,
  ): Promise<SafeUser> {
    await this.findMembershipOrThrow(id);
    this.assertCanManage(actor, id);

    const before = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: SAFE_USER_SELECT,
    });

    const after = await this.prisma.user.update({
      where: { id },
      data: { firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone },
      select: SAFE_USER_SELECT,
    });

    await this.auditLog.record({
      organizationId,
      actorUserId: actor.userId,
      action: 'user.updated',
      entityType: 'User',
      entityId: id,
      before,
      after,
    });

    return after;
  }

  /**
   * Removes a user's membership from the caller's active organization
   * (the global `User` row is untouched — see the class-level scope note).
   * @param organizationId the caller's active organization
   * @param actor the caller, for authorization and the audit trail
   * @param actor.userId the caller's global User id
   * @param actor.role the caller's active membership role
   * @param id the user to remove from the caller's active organization
   */
  async remove(
    organizationId: string,
    actor: { userId: string; role: string },
    id: string,
  ): Promise<void> {
    const membership = await this.findMembershipOrThrow(id);
    this.assertCanManage(actor, id);

    await this.memberships.remove(organizationId, actor.userId, membership.id);
  }

  /**
   * Fetches the caller's-active-organization membership for a user, with the user attached.
   * @param userId the user to look up
   * @returns the matching membership, with its user
   * @throws NotFoundException if the user has no membership in the caller's active organization
   */
  private async findMembershipOrThrow(userId: string): Promise<{ id: string; user: SafeUser }> {
    const membership = await this.tenantContext.client.organizationMembership.findFirst({
      where: { userId },
      select: { id: true, user: { select: SAFE_USER_SELECT } },
    });
    if (!membership) {
      throw new NotFoundException('User not found in the caller’s active organization.');
    }
    return membership;
  }

  /**
   * Rejects the call unless the caller is managing their own record or is an Owner/Admin.
   * @param actor the caller
   * @param actor.userId the caller's global User id
   * @param actor.role the caller's active membership role
   * @param targetUserId the user being changed
   * @throws ForbiddenException if the caller may not manage this user
   */
  private assertCanManage(actor: { userId: string; role: string }, targetUserId: string): void {
    const isSelf = actor.userId === targetUserId;
    const isOrgManager = actor.role === RoleCode.OWNER || actor.role === RoleCode.ADMIN;
    if (!isSelf && !isOrgManager) {
      throw new ForbiddenException('Only the user themselves or an Owner/Admin can do this.');
    }
  }
}
