import { Injectable, NotFoundException } from '@nestjs/common';
import type { Client, ClientAddress } from '@prisma/client';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AuditLogWriterService } from '../audit-logs/audit-log-writer.service';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type { CreateClientAddressDto } from './dto/create-client-address.dto';

/**
 * Client (customer) records and their service/billing addresses.
 * `remove` soft-deletes (sets `deletedAt`) rather than deleting the row —
 * a client's history (jobs, invoices) must stay attributable even after
 * they're no longer active.
 */
@Injectable()
export class ClientsService {
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
   * @returns every non-deleted client in the caller's active organization
   */
  list(): Promise<Client[]> {
    return this.tenantContext.client.client.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Creates a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param dto the client to create
   * @returns the created record
   */
  async create(organizationId: string, actorUserId: string, dto: CreateClientDto): Promise<Client> {
    const client = await this.tenantContext.client.client.create({
      data: {
        organizationId,
        name: dto.name,
        type: dto.type,
        primaryContactName: dto.primaryContactName,
        email: dto.email,
        phone: dto.phone,
        notes: dto.notes,
      },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'client.created',
      entityType: 'Client',
      entityId: client.id,
      after: client,
    });

    return client;
  }

  /**
   * Fetches a single record.
   * @param id the client to fetch
   * @returns the matching record
   */
  async findOne(id: string): Promise<Client> {
    return this.findOrThrow(id);
  }

  /**
   * Updates a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param id the client to update
   * @param dto the fields to change
   * @returns the updated record
   */
  async update(
    organizationId: string,
    actorUserId: string,
    id: string,
    dto: UpdateClientDto,
  ): Promise<Client> {
    const before = await this.findOrThrow(id);

    const after = await this.tenantContext.client.client.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        status: dto.status,
        primaryContactName: dto.primaryContactName,
        email: dto.email,
        phone: dto.phone,
        notes: dto.notes,
      },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'client.updated',
      entityType: 'Client',
      entityId: id,
      before,
      after,
    });

    return after;
  }

  /**
   * Soft-deletes a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param id the client to remove
   */
  async remove(organizationId: string, actorUserId: string, id: string): Promise<void> {
    const before = await this.findOrThrow(id);

    const after = await this.tenantContext.client.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'client.removed',
      entityType: 'Client',
      entityId: id,
      before,
      after,
    });
  }

  /**
   * Lists addresses.
   * @param clientId the client to list addresses for
   * @returns the matching addresses
   */
  async listAddresses(clientId: string): Promise<ClientAddress[]> {
    await this.findOrThrow(clientId);
    return this.tenantContext.client.clientAddress.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Creates an address.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param clientId the client to add an address to
   * @param dto the address to create
   * @returns the created address
   */
  async createAddress(
    organizationId: string,
    actorUserId: string,
    clientId: string,
    dto: CreateClientAddressDto,
  ): Promise<ClientAddress> {
    await this.findOrThrow(clientId);

    const address = await this.tenantContext.client.clientAddress.create({
      data: {
        organizationId,
        clientId,
        label: dto.label,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        lat: dto.lat,
        lng: dto.lng,
      },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'client_address.created',
      entityType: 'ClientAddress',
      entityId: address.id,
      after: address,
    });

    return address;
  }

  /**
   * Fetches a non-deleted client or throws if it can't be found.
   * @param id the client to fetch
   * @returns the matching record
   * @throws NotFoundException if no non-deleted client matches in the caller's active organization
   */
  private async findOrThrow(id: string): Promise<Client> {
    const client = await this.tenantContext.client.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('Client not found.');
    }
    return client;
  }
}
