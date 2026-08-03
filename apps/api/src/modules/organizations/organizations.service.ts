import { Injectable, NotImplementedException } from '@nestjs/common';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';

/**
 * Organization settings. Fase 2 scope note (see apps/api/README.md and
 * root CONTRIBUTING.md): the contract below is real and reviewable
 * (controller, DTOs, Swagger, guards); the implementation is deferred to
 * Fase 3, and every method fails loudly via `NotImplementedException`
 * rather than silently returning a placeholder.
 */
@Injectable()
export class OrganizationsService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   */
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Fetches the organization. Stubbed for Fase 3 — see the class-level scope note.
   */
  getMine(): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Updates the organization. Stubbed for Fase 3 — see the class-level scope note.
   * @param _dto the fields to update
   */
  updateMine(_dto: UpdateOrganizationDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }
}
