import { Injectable, NotImplementedException } from '@nestjs/common';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { UpdateMembershipDto } from './dto/update-membership.dto';

/**
 * Manages who belongs to the caller's active organization and with what
 * role/status — distinct from `modules/users` (global identity) and
 * `modules/auth`'s invitation flow (how a membership is first created).
 * Fase 2 scope note: see `organizations.service.ts` for the pattern this follows.
 */
@Injectable()
export class MembershipsService {
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

  /**
   * Updates a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _membershipId the membership to update
   * @param _dto the fields to change
   */
  update(_membershipId: string, _dto: UpdateMembershipDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Removes a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _membershipId the membership to remove
   */
  remove(_membershipId: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }
}
