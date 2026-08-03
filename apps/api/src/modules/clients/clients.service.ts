import { Injectable, NotImplementedException } from '@nestjs/common';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type { CreateClientAddressDto } from './dto/create-client-address.dto';

/**
 * Client (customer) records and their service/billing addresses. Fase 2
 * scope note: see `organizations.service.ts` for the pattern this follows.
 */
@Injectable()
export class ClientsService {
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
   * Creates a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _dto the client to create
   */
  create(_dto: CreateClientDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Fetches a single record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the client to fetch
   */
  findOne(_id: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Updates a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the client to update
   * @param _dto the fields to change
   */
  update(_id: string, _dto: UpdateClientDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Removes a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the client to remove
   */
  remove(_id: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Lists addresses. Stubbed for Fase 3 — see the class-level scope note.
   * @param _clientId the client to list addresses for
   */
  listAddresses(_clientId: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Creates an address. Stubbed for Fase 3 — see the class-level scope note.
   * @param _clientId the client to add an address to
   * @param _dto the address to create
   */
  createAddress(_clientId: string, _dto: CreateClientAddressDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }
}
