import { Injectable, NotImplementedException } from '@nestjs/common';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { UpdateStaffDto } from './dto/update-staff.dto';

/**
 * Employment-specific fields for staff members (`StaffProfile`, 1:1 with
 * an `OrganizationMembership` — see schema.prisma). Creation happens via
 * the invitation flow in `modules/auth`, not here. Fase 2 scope note: see
 * `organizations.service.ts` for the pattern this follows.
 */
@Injectable()
export class StaffService {
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
   * @param _id the staff profile to fetch
   */
  findOne(_id: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Updates a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the staff profile to update
   * @param _dto the fields to change
   */
  update(_id: string, _dto: UpdateStaffDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }
}
