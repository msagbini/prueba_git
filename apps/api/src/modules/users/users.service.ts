import { Injectable, NotImplementedException } from '@nestjs/common';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { UpdateUserDto } from './dto/update-user.dto';

/**
 * Users visible to the caller — i.e. users who share an
 * `organization_memberships` row with the caller's active organization
 * (see the "one exception: users" section of
 * docs/architecture/multi-tenancy.md; `users` itself has no
 * `organizationId`/RLS, so this scoping is enforced here at the service
 * layer, not by the database). Fase 2 scope note: see
 * `organizations.service.ts` for the pattern this follows.
 */
@Injectable()
export class UsersService {
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
   * Fetches a single record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the user to fetch
   */
  findOne(_id: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Updates a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the user to update
   * @param _dto the fields to change
   */
  update(_id: string, _dto: UpdateUserDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Removes a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the user to remove from the caller's active organization
   */
  remove(_id: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }
}
