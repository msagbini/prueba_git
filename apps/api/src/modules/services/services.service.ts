import { Injectable, NotImplementedException } from '@nestjs/common';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';

/**
 * The service catalog: categories and priced, sellable services. Fase 2
 * scope note: see `organizations.service.ts` for the pattern this follows.
 */
@Injectable()
export class ServicesService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   */
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Lists categories. Stubbed for Fase 3 — see the class-level scope note.
   */
  listCategories(): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Creates a category. Stubbed for Fase 3 — see the class-level scope note.
   * @param _dto the category to create
   */
  createCategory(_dto: CreateServiceCategoryDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Lists records. Stubbed for Fase 3 — see the class-level scope note.
   */
  list(): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Creates a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _dto the service to create
   */
  create(_dto: CreateServiceDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Fetches a single record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the service to fetch
   */
  findOne(_id: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Updates a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the service to update
   * @param _dto the fields to change
   */
  update(_id: string, _dto: UpdateServiceDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Removes a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the service to remove
   */
  remove(_id: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }
}
